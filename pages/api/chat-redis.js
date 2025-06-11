import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const getUserKey = (userId) => `user:${userId}`
const getChatKey = (user1, user2) => `chat:${[user1, user2].sort().join('_')}`
const getMessagesKey = (chatId) => `messages:${chatId}`
const getLastSeenKey = (userId, chatWith) => `lastseen:${userId}_${chatWith}`
const getTypingKey = (chatId) => `typing:${chatId}`

const safeStringify = (obj) => {
  try {
    return typeof obj === 'string' ? obj : JSON.stringify(obj)
  } catch {
    return JSON.stringify({})
  }
}

const safeParse = (str) => {
  try {
    if (typeof str === 'object') return str
    return typeof str === 'string' ? JSON.parse(str) : {}
  } catch {
    return {}
  }
}

export default async function handler(req, res) {
  try {
    const startTime = Date.now()
    console.log(`📡 Redis API: ${req.method} ${req.url}`)
    
    const { method } = req
    
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (method === 'POST') {
      const { action, userId, data } = req.body || {}
      
      if (!action || !userId) {
        return res.status(400).json({ error: 'Missing action or userId' })
      }
      
      switch (action) {
        case 'register':
          try {
            await redis.set(getUserKey(userId), Date.now(), { ex: 3600 })
            console.log(`✅ User registered: ${userId}`)
            return res.json({ success: true, message: 'User registered' })
          } catch (error) {
            console.error('❌ Register error:', error)
            return res.status(500).json({ error: 'Registration failed' })
          }
          
        case 'search':
          try {
            const { searchId } = data || {}
            if (!searchId) {
              return res.status(400).json({ error: 'Missing searchId' })
            }
            
            const userExists = await redis.get(getUserKey(searchId))
            const exists = userExists !== null
            
            if (exists && userId !== searchId) {
              const pipeline = redis.pipeline()
              pipeline.sadd(`chats:${userId}`, searchId)
              pipeline.sadd(`chats:${searchId}`, userId)
              pipeline.expire(`chats:${userId}`, 3600)
              pipeline.expire(`chats:${searchId}`, 3600)
              await pipeline.exec()
              
              console.log(`✅ Chat relationship created: ${userId} <-> ${searchId}`)
            }
            
            return res.json({ exists, userId: searchId })
          } catch (error) {
            console.error('❌ Search error:', error)
            return res.status(500).json({ error: 'Search failed' })
          }
          
        case 'send':
          try {
            const { from, to, message } = data || {}
            if (!from || !to || !message) {
              return res.status(400).json({ error: 'Missing from, to, or message' })
            }
            
            const chatId = getChatKey(from, to)
            const messageData = {
              id: Date.now(),
              from,
              to,
              message,
              timestamp: new Date().toISOString()
            }
            
            const pipeline = redis.pipeline()
            pipeline.lpush(getMessagesKey(chatId), safeStringify(messageData))
            pipeline.expire(getMessagesKey(chatId), 3600)
            pipeline.sadd(`chats:${from}`, to)
            pipeline.sadd(`chats:${to}`, from)
            pipeline.expire(`chats:${from}`, 3600)
            pipeline.expire(`chats:${to}`, 3600)
            pipeline.hdel(getTypingKey(chatId), from)
            await pipeline.exec()
            
            console.log(`📨 Message sent: ${from} → ${to}`)
            return res.json({ success: true, message: messageData })
          } catch (error) {
            console.error('❌ Send error:', error)
            return res.status(500).json({ error: 'Failed to send message' })
          }
          
        case 'mark_read':
          try {
            const { chatWith } = data || {}
            if (!chatWith) {
              return res.status(400).json({ error: 'Missing chatWith' })
            }
            
            await redis.set(getLastSeenKey(userId, chatWith), Date.now(), { ex: 3600 })
            return res.json({ success: true, message: 'Marked as read' })
          } catch (error) {
            console.error('❌ Mark read error:', error)
            return res.status(500).json({ error: 'Failed to mark as read' })
          }
          
        case 'typing':
          try {
            const { chatWith, isTyping } = data || {}
            if (!chatWith || typeof isTyping !== 'boolean') {
              return res.status(400).json({ error: 'Missing chatWith or isTyping' })
            }
            
            const chatId = getChatKey(userId, chatWith)
            const typingKey = getTypingKey(chatId)
            
            if (isTyping) {
              await redis.hset(typingKey, userId, Date.now())
              await redis.expire(typingKey, 60)
            } else {
              await redis.hdel(typingKey, userId)
            }
            
            return res.json({ success: true, message: 'Typing status updated' })
          } catch (error) {
            console.error('❌ Typing error:', error)
            return res.status(500).json({ error: 'Failed to update typing status' })
          }
          
        default:
          return res.status(400).json({ error: `Invalid action: ${action}` })
      }
    }
    
    if (method === 'GET') {
      const { userId, chatWith, getTyping } = req.query || {}
      
      if (getTyping && userId && chatWith) {
        try {
          const chatId = getChatKey(userId, chatWith)
          const typingData = await redis.hgetall(getTypingKey(chatId)) || {}
          
          const now = Date.now()
          const fiveSecondsAgo = now - 5000
          
          const activeTypers = Object.entries(typingData)
            .filter(([user, timestamp]) => 
              user !== userId && parseInt(timestamp) > fiveSecondsAgo
            )
            .map(([user, _]) => user)
          
          const elapsed = Date.now() - startTime
          console.log(`⌨️ Typing check for ${userId}: ${elapsed}ms`)
          
          return res.json({ 
            isTyping: activeTypers.length > 0,
            typingUsers: activeTypers 
          })
        } catch (error) {
          console.error('❌ Get typing error:', error)
          return res.status(500).json({ error: 'Failed to get typing status' })
        }
      }
      
      if (userId && chatWith) {
        try {
          const chatId = getChatKey(userId, chatWith)
          const messagesData = await redis.lrange(getMessagesKey(chatId), 0, -1) || []
          
          const messages = messagesData
            .map(msg => safeParse(msg))
            .reverse()
            .filter(msg => msg && msg.id)
          
          const elapsed = Date.now() - startTime
          console.log(`📥 Messages for ${chatId}: ${messages.length} messages in ${elapsed}ms`)
          
          return res.json({ messages })
        } catch (error) {
          console.error('❌ Get messages error:', error)
          return res.status(500).json({ error: 'Failed to get messages' })
        }
      }
      
      if (userId) {
        try {
          const fetchStart = Date.now()
          const chatUserIds = await redis.smembers(`chats:${userId}`) || []
          
          if (chatUserIds.length === 0) {
            const elapsed = Date.now() - startTime
            console.log(`📋 No chats for ${userId}: ${elapsed}ms`)
            return res.json({ chats: [] })
          }
          
          console.log(`📋 Found ${chatUserIds.length} chats for ${userId}`)
          
          const chatPromises = chatUserIds.map(async (chatUserId) => {
            try {
              const chatId = getChatKey(userId, chatUserId)
              
              const [latestMessages, lastSeenTime] = await Promise.race([
                Promise.all([
                  redis.lrange(getMessagesKey(chatId), 0, 0),
                  redis.get(getLastSeenKey(userId, chatUserId))
                ]),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Individual chat timeout')), 5000)
                )
              ])
              
              let lastMessage = ''
              let lastMessageTime = null
              let unreadCount = 0
              
              if (latestMessages[0] && latestMessages[0].length > 0) {
                const messageObj = safeParse(latestMessages[0][0])
                if (messageObj && messageObj.message) {
                  lastMessage = messageObj.message
                  lastMessageTime = messageObj.timestamp
                  
                  const lastSeen = parseInt(lastSeenTime || 0)
                  const messageTime = new Date(messageObj.timestamp).getTime()
                  
                  if (messageObj.from !== userId && messageTime > lastSeen) {
                    unreadCount = 1
                  }
                }
              }
              
              return {
                id: chatUserId,
                name: chatUserId,
                lastMessage,
                lastMessageTime,
                unreadCount,
                hasUnread: unreadCount > 0
              }
            } catch (error) {
              console.error(`❌ Error processing ${chatUserId}:`, error.message)
              return {
                id: chatUserId,
                name: chatUserId,
                lastMessage: '',
                lastMessageTime: null,
                unreadCount: 0,
                hasUnread: false
              }
            }
          })
          
          const results = await Promise.allSettled(chatPromises)
          const chatList = results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value)
          
          chatList.sort((a, b) => {
            if (a.hasUnread && !b.hasUnread) return -1
            if (!a.hasUnread && b.hasUnread) return 1
            
            if (a.lastMessageTime && b.lastMessageTime) {
              return new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
            }
            
            return 0
          })
          
          const elapsed = Date.now() - startTime
          console.log(`📋 Chats for ${userId}: ${chatList.length} chats in ${elapsed}ms`)
          
          return res.json({ chats: chatList })
        } catch (error) {
          console.error('❌ Get chats error:', error)
          return res.status(500).json({ error: 'Failed to get chats' })
        }
      }
      
      return res.status(400).json({ error: 'Missing parameters' })
    }
    
    res.status(405).json({ error: `Method ${method} not allowed` })
    
  } catch (error) {
    console.error('❌ Critical error:', error)
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
}