import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  retry: {
    retries: 3,
    backoff: (retryCount) => Math.min(retryCount * 100, 1000)
  },
  enableAutoPipelining: false,
})

const log = (msg, data = '') => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${msg}`, data)
}

const getUserKey = (userId) => `user:${userId}`
const getChatKey = (user1, user2) => `chat:${[user1, user2].sort().join('_')}`
const getMessagesKey = (chatId) => `messages:${chatId}`
const getLastSeenKey = (userId, chatWith) => `lastseen:${userId}_${chatWith}`
const getTypingKey = (chatId) => `typing:${chatId}`

const safeStringify = (obj) => {
  try {
    return typeof obj === 'string' ? obj : JSON.stringify(obj)
  } catch (error) {
    log('❌ Stringify error:', error.message)
    return JSON.stringify({})
  }
}

const safeParse = (str) => {
  try {
    if (typeof str === 'object') return str
    return typeof str === 'string' ? JSON.parse(str) : {}
  } catch (error) {
    log('❌ Parse error:', error.message)
    return {}
  }
}

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).substr(2, 9)
  const startTime = Date.now()
  
  try {
    log(`📡 [${requestId}] ${req.method} ${req.url}`)
    
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      log('❌ Missing Redis environment variables')
      return res.status(500).json({ 
        error: 'Server configuration error - missing Redis credentials',
        requestId 
      })
    }
    
    const { method } = req
    
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (method === 'POST') {
      const { action, userId, data } = req.body || {}
      
      log(`📨 [${requestId}] Action: ${action}, User: ${userId}`)
      
      if (!action) {
        return res.status(400).json({ error: 'Missing action', requestId })
      }
      if (!userId || userId.trim() === '') {
        return res.status(400).json({ error: 'Missing or empty userId', requestId })
      }
      
      switch (action) {
        case 'register':
          try {
            log(`🔄 [${requestId}] Registering user: ${userId}`)
            await redis.set(getUserKey(userId), Date.now(), { ex: 3600 })
            
            log(`✅ [${requestId}] User registered successfully: ${userId}`)
            return res.json({ 
              success: true, 
              message: 'User registered',
              userId,
              requestId 
            })
          } catch (error) {
            log(`❌ [${requestId}] Register error:`, error.message)
            return res.status(500).json({ 
              error: 'Registration failed', 
              details: error.message,
              requestId 
            })
          }
          
        case 'search':
          try {
            const { searchId } = data || {}
            if (!searchId || searchId.trim() === '') {
              return res.status(400).json({ error: 'Missing or empty searchId', requestId })
            }
            
            log(`🔍 [${requestId}] Searching for user: ${searchId}`)
            const userExists = await redis.get(getUserKey(searchId))
            const exists = userExists !== null
            
            if (exists && userId !== searchId) {
              log(`🔄 [${requestId}] Creating chat relationship: ${userId} <-> ${searchId}`)
              await redis.sadd(`chats:${userId}`, searchId)
              await redis.sadd(`chats:${searchId}`, userId)
              await redis.expire(`chats:${userId}`, 3600)
              await redis.expire(`chats:${searchId}`, 3600)
            }
            
            log(`✅ [${requestId}] Search complete: ${searchId} exists=${exists}`)
            return res.json({ exists, userId: searchId, requestId })
          } catch (error) {
            log(`❌ [${requestId}] Search error:`, error.message)
            return res.status(500).json({ 
              error: 'Search failed', 
              details: error.message,
              requestId 
            })
          }
          
        case 'send':
          try {
            const { from, to, message } = data || {}
            if (!from || !to || !message) {
              return res.status(400).json({ 
                error: 'Missing from, to, or message', 
                provided: { from: !!from, to: !!to, message: !!message },
                requestId 
              })
            }
            
            const chatId = getChatKey(from, to)
            const messageData = {
              id: Date.now(),
              from,
              to,
              message,
              timestamp: new Date().toISOString()
            }
            
            log(`📨 [${requestId}] Sending message: ${from} → ${to}`)
            await redis.lpush(getMessagesKey(chatId), safeStringify(messageData))
            await redis.expire(getMessagesKey(chatId), 3600)
            await redis.sadd(`chats:${from}`, to)
            await redis.sadd(`chats:${to}`, from)
            await redis.expire(`chats:${from}`, 3600)
            await redis.expire(`chats:${to}`, 3600)
            
            // Clear typing indicator when message is sent
            await redis.hdel(getTypingKey(chatId), from)
            
            log(`✅ [${requestId}] Message sent successfully`)
            return res.json({ success: true, message: messageData, requestId })
          } catch (error) {
            log(`❌ [${requestId}] Send error:`, error.message)
            return res.status(500).json({ 
              error: 'Failed to send message', 
              details: error.message,
              requestId 
            })
          }
          
        case 'mark_read':
          try {
            const { chatWith } = data || {}
            if (!chatWith) {
              return res.status(400).json({ error: 'Missing chatWith', requestId })
            }
            
            await redis.set(getLastSeenKey(userId, chatWith), Date.now(), { ex: 3600 })
            log(`👁️ [${requestId}] Marked as read: ${userId} → ${chatWith}`)
            return res.json({ success: true, message: 'Marked as read', requestId })
          } catch (error) {
            log(`❌ [${requestId}] Mark read error:`, error.message)
            return res.status(500).json({ 
              error: 'Failed to mark as read', 
              details: error.message,
              requestId 
            })
          }
          
        case 'typing':
          try {
            const { chatWith, isTyping } = data || {}
            if (!chatWith || typeof isTyping !== 'boolean') {
              return res.status(400).json({ 
                error: 'Missing chatWith or invalid isTyping', 
                provided: { chatWith: !!chatWith, isTyping: typeof isTyping },
                requestId 
              })
            }
            
            const chatId = getChatKey(userId, chatWith)
            const typingKey = getTypingKey(chatId)
            const timestamp = Date.now()
            
            log(`⌨️ [${requestId}] Typing action: ${userId} → ${chatWith}, typing: ${isTyping}`)
            log(`⌨️ [${requestId}] Chat ID: ${chatId}, Key: ${typingKey}`)
            
            if (isTyping) {
              // Set typing status with current timestamp
              await redis.hset(typingKey, userId, timestamp)
              await redis.expire(typingKey, 30) // 30 seconds expiry
              log(`⌨️ [${requestId}] Set typing: ${userId} at ${timestamp}`)
            } else {
              // Remove typing status
              await redis.hdel(typingKey, userId)
              log(`⌨️ [${requestId}] Removed typing: ${userId}`)
            }
            
            // Debug: Check what's in Redis after setting
            const debugTypingData = await redis.hgetall(typingKey)
            log(`⌨️ [${requestId}] Debug - typing data after operation:`, debugTypingData)
            
            return res.json({ 
              success: true, 
              message: 'Typing status updated', 
              debug: { chatId, typingKey, timestamp, debugTypingData },
              requestId 
            })
          } catch (error) {
            log(`❌ [${requestId}] Typing error:`, error.message)
            return res.status(500).json({ 
              error: 'Failed to update typing status', 
              details: error.message,
              requestId 
            })
          }
          
        default:
          return res.status(400).json({ error: `Invalid action: ${action}`, requestId })
      }
    }
    
    if (method === 'GET') {
      const { userId, chatWith, getTyping } = req.query || {}
      
      log(`📥 [${requestId}] GET params:`, { userId, chatWith, getTyping })
      
      if (!userId || userId.trim() === '') {
        return res.status(400).json({ 
          error: 'Missing or empty userId parameter',
          received: { userId, chatWith, getTyping },
          requestId 
        })
      }
      
      if (getTyping && chatWith) {
        try {
          const chatId = getChatKey(userId, chatWith)
          const typingKey = getTypingKey(chatId)
          
          log(`⌨️ [${requestId}] Checking typing for chat: ${chatId}, key: ${typingKey}`)
          
          const typingData = await redis.hgetall(typingKey) || {}
          log(`⌨️ [${requestId}] Raw typing data:`, typingData)
          
          const now = Date.now()
          const fiveSecondsAgo = now - 5000 // 5 seconds tolerance
          
          const activeTypers = Object.entries(typingData)
            .filter(([user, timestamp]) => {
              const isNotSelf = user !== userId
              const isRecent = parseInt(timestamp) > fiveSecondsAgo
              
              log(`⌨️ [${requestId}] Check user ${user}: notSelf=${isNotSelf}, recent=${isRecent}, timestamp=${timestamp}, now=${now}`)
              
              return isNotSelf && isRecent
            })
            .map(([user, _]) => user)
          
          const isTyping = activeTypers.length > 0
          
          log(`⌨️ [${requestId}] Final result: isTyping=${isTyping}, activeTypers=[${activeTypers.join(', ')}]`)
          
          return res.json({ 
            isTyping,
            typingUsers: activeTypers,
            debug: { 
              chatId, 
              typingKey, 
              typingData, 
              now, 
              fiveSecondsAgo, 
              activeTypers 
            },
            requestId 
          })
        } catch (error) {
          log(`❌ [${requestId}] Typing check error:`, error.message)
          return res.status(500).json({ 
            error: 'Failed to get typing status', 
            details: error.message,
            requestId 
          })
        }
      }
      
      if (chatWith) {
        try {
          const chatId = getChatKey(userId, chatWith)
          log(`📥 [${requestId}] Getting messages for: ${chatId}`)
          
          const messagesData = await redis.lrange(getMessagesKey(chatId), 0, -1) || []
          
          const messages = messagesData
            .map(msg => safeParse(msg))
            .reverse()
            .filter(msg => msg && msg.id)
          
          const elapsed = Date.now() - startTime
          log(`✅ [${requestId}] Messages loaded: ${messages.length} (${elapsed}ms)`)
          
          return res.json({ messages, requestId })
        } catch (error) {
          log(`❌ [${requestId}] Get messages error:`, error.message)
          return res.status(500).json({ 
            error: 'Failed to get messages', 
            details: error.message,
            requestId 
          })
        }
      }
      
      try {
        log(`📋 [${requestId}] Getting chats for: ${userId}`)
        const chatUserIds = await redis.smembers(`chats:${userId}`) || []
        
        if (chatUserIds.length === 0) {
          const elapsed = Date.now() - startTime
          log(`📋 [${requestId}] No chats found (${elapsed}ms)`)
          return res.json({ chats: [], requestId })
        }
        
        log(`📋 [${requestId}] Processing ${chatUserIds.length} chats`)
        
        const chatPromises = chatUserIds.map(async (chatUserId, index) => {
          try {
            log(`📋 [${requestId}] Processing chat ${index + 1}/${chatUserIds.length}: ${chatUserId}`)
            
            const chatId = getChatKey(userId, chatUserId)
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Chat timeout')), 8000)
            )
            
            const [messagesData, lastSeenTime] = await Promise.race([
              Promise.all([
                redis.lrange(getMessagesKey(chatId), 0, 20),
                redis.get(getLastSeenKey(userId, chatUserId))
              ]),
              timeoutPromise
            ])
            
            let lastMessage = ''
            let lastMessageTime = null
            let unreadCount = 0
            
            if (messagesData && messagesData.length > 0) {
              const latestMsg = safeParse(messagesData[0])
              if (latestMsg && latestMsg.message) {
                lastMessage = latestMsg.message
                lastMessageTime = latestMsg.timestamp
              }
              
              const lastSeen = parseInt(lastSeenTime || 0)
              
              for (const msgStr of messagesData) {
                const msg = safeParse(msgStr)
                if (msg && msg.from !== userId && msg.id) {
                  const msgTime = parseInt(msg.id)
                  if (msgTime > lastSeen) {
                    unreadCount++
                  }
                }
              }
            }
            
            log(`✅ [${requestId}] Chat ${index + 1} processed: ${chatUserId}, unread: ${unreadCount}`)
            
            return {
              id: chatUserId,
              name: chatUserId,
              lastMessage,
              lastMessageTime,
              unreadCount,
              hasUnread: unreadCount > 0
            }
          } catch (error) {
            log(`❌ [${requestId}] Chat ${index + 1} error (${chatUserId}):`, error.message)
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
        log(`✅ [${requestId}] Chats loaded: ${chatList.length} (${elapsed}ms)`)
        
        return res.json({ chats: chatList, requestId })
      } catch (error) {
        log(`❌ [${requestId}] Get chats error:`, error.message)
        return res.status(500).json({ 
          error: 'Failed to get chats', 
          details: error.message,
          requestId 
        })
      }
    }
    
    res.status(405).json({ error: `Method ${method} not allowed`, requestId })
    
  } catch (error) {
    const elapsed = Date.now() - startTime
    log(`❌ [${requestId}] Critical error (${elapsed}ms):`, error.message)
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      requestId,
      timestamp: new Date().toISOString()
    })
  }
}