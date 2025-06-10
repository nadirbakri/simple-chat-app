let users = new Map()
let messages = new Map()
let userChats = new Map()
let lastSeen = new Map()
let typingUsers = new Map()

setInterval(() => {
  const now = Date.now()
  const oneHour = 60 * 60 * 1000
  
  for (const [userId, timestamp] of users.entries()) {
    if (now - timestamp > oneHour) {
      users.delete(userId)
      userChats.delete(userId)
      
      for (const [key, _] of lastSeen.entries()) {
        if (key.startsWith(userId + '_') || key.endsWith('_' + userId)) {
          lastSeen.delete(key)
        }
      }
      
      console.log(`✅ User ${userId} data deleted after 1 hour`)
    }
  }
  
  const tenSecondsAgo = now - 10000
  for (const [chatId, typingData] of typingUsers.entries()) {
    for (const [userId, timestamp] of Object.entries(typingData)) {
      if (timestamp < tenSecondsAgo) {
        delete typingData[userId]
      }
    }
    if (Object.keys(typingData).length === 0) {
      typingUsers.delete(chatId)
    }
  }
}, 5 * 60 * 1000)

const getChatId = (user1, user2) => [user1, user2].sort().join('_')
const getLastSeenKey = (userId, chatWith) => `${userId}_${chatWith}`
const getUnreadCount = (userId, chatWith, messagesArray) => {
  const lastSeenKey = getLastSeenKey(userId, chatWith)
  const lastSeenTime = lastSeen.get(lastSeenKey) || 0
  
  return messagesArray.filter(msg => 
    msg.from !== userId &&
    new Date(msg.timestamp).getTime() > lastSeenTime
  ).length
}

export default function handler(req, res) {
  const { method } = req
  
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (method === 'POST') {
    const { action, userId, data } = req.body
    
    switch (action) {
      case 'register':
        users.set(userId, Date.now())
        if (!userChats.has(userId)) {
          userChats.set(userId, new Set())
        }
        console.log(`✅ User registered: ${userId}`)
        return res.json({ success: true, message: 'User registered' })
        
      case 'search':
        const { searchId } = data
        const exists = users.has(searchId)
        
        if (exists && userId !== searchId) {
          if (!userChats.has(userId)) userChats.set(userId, new Set())
          if (!userChats.has(searchId)) userChats.set(searchId, new Set())
          
          userChats.get(userId).add(searchId)
          userChats.get(searchId).add(userId)
          
          console.log(`✅ Chat relationship created: ${userId} <-> ${searchId}`)
        }
        
        console.log(`🔍 Search for ${searchId}: ${exists}`)
        return res.json({ exists, userId: searchId })
        
      case 'send':
        const { from, to, message } = data
        const chatId = getChatId(from, to)
        
        if (!messages.has(chatId)) {
          messages.set(chatId, [])
        }
        
        const messageData = {
          id: Date.now(),
          from,
          to,
          message,
          timestamp: new Date().toISOString()
        }
        
        messages.get(chatId).push(messageData)
        
        if (typingUsers.has(chatId)) {
          delete typingUsers.get(chatId)[from]
        }
        
        if (!userChats.has(from)) userChats.set(from, new Set())
        if (!userChats.has(to)) userChats.set(to, new Set())
        
        userChats.get(from).add(to)
        userChats.get(to).add(from)
        
        console.log(`📨 Message sent from ${from} to ${to}`)
        return res.json({ success: true, message: messageData })
        
      case 'mark_read':
        const { chatWith } = data
        const lastSeenKey = getLastSeenKey(userId, chatWith)
        lastSeen.set(lastSeenKey, Date.now())
        
        console.log(`👁️ ${userId} marked ${chatWith} as read`)
        return res.json({ success: true, message: 'Marked as read' })
        
      case 'typing':
        try {
            const { chatWith, isTyping } = data || {}
            console.log(`⌨️ TYPING REQUEST: userId=${userId}, chatWith=${chatWith}, isTyping=${isTyping}`)
            
            if (!chatWith || typeof isTyping !== 'boolean') {
            console.log(`❌ Invalid typing data: chatWith=${chatWith}, isTyping=${isTyping}`)
            return res.status(400).json({ error: 'Missing chatWith or isTyping' })
            }
            
            const typingChatId = getChatId(userId, chatWith)
            console.log(`💬 Generated typing chatId: ${typingChatId}`)
            
            if (!typingUsers.has(typingChatId)) {
            typingUsers.set(typingChatId, {})
            console.log(`📝 Created new typing entry for: ${typingChatId}`)
            }
            
            const typingData = typingUsers.get(typingChatId)
            
            if (isTyping) {
            typingData[userId] = Date.now()
            console.log(`✅ ${userId} is now typing to ${chatWith} at ${Date.now()}`)
            console.log(`📊 All typing users for ${typingChatId}:`, typingData)
            } else {
            delete typingData[userId]
            console.log(`❌ ${userId} stopped typing to ${chatWith}`)
            console.log(`📊 Remaining typing users for ${typingChatId}:`, typingData)
            }
            
            return res.json({ success: true, message: 'Typing status updated' })
        } catch (error) {
            console.error('❌ Typing error:', error.message)
            return res.status(500).json({ error: 'Failed to update typing status' })
        }
        
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  }
  
  if (method === 'GET') {
    const { userId, chatWith, getTyping } = req.query
    
    if (getTyping && userId && chatWith) {
        try {
            console.log(`🔍 GET TYPING: userId=${userId}, chatWith=${chatWith}`)
            
            const chatId = getChatId(userId, chatWith)
            const typingData = typingUsers.get(chatId) || {}
            
            console.log(`📊 Raw typing data for ${chatId}:`, typingData)
            
            const now = Date.now()
            const fiveSecondsAgo = now - 5000
            
            const activeTypers = Object.entries(typingData)
            .filter(([user, timestamp]) => {
                const isNotSelf = user !== userId
                const isRecent = timestamp > fiveSecondsAgo
                console.log(`👤 User ${user}: isNotSelf=${isNotSelf}, isRecent=${isRecent}, timestamp=${timestamp}`)
                return isNotSelf && isRecent
            })
            .map(([user, _]) => user)
            
            console.log(`✅ Active typers for ${userId}:`, activeTypers)
            
            return res.json({ 
            isTyping: activeTypers.length > 0,
            typingUsers: activeTypers 
            })
        } catch (error) {
            console.error('❌ Get typing error:', error.message)
            return res.status(500).json({ error: 'Failed to get typing status' })
        }
    }

    
    if (userId && chatWith) {
      const chatId = getChatId(userId, chatWith)
      const chatMessages = messages.get(chatId) || []
      return res.json({ messages: chatMessages })
    }
    
    if (userId) {
      const chats = userChats.get(userId) || new Set()
      const chatList = Array.from(chats).map(chatUserId => {
        const chatId = getChatId(userId, chatUserId)
        const chatMessages = messages.get(chatId) || []
        const lastMessage = chatMessages[chatMessages.length - 1]
        const unreadCount = getUnreadCount(userId, chatUserId, chatMessages)
        
        return {
          id: chatUserId,
          name: chatUserId,
          lastMessage: lastMessage ? lastMessage.message : '',
          lastMessageTime: lastMessage ? lastMessage.timestamp : null,
          unreadCount,
          hasUnread: unreadCount > 0
        }
      })
      
      chatList.sort((a, b) => {
        if (a.hasUnread && !b.hasUnread) return -1
        if (!a.hasUnread && b.hasUnread) return 1
        
        if (a.lastMessageTime && b.lastMessageTime) {
          return new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
        }
        
        return 0
      })
      
      return res.json({ chats: chatList })
    }
    
    return res.status(400).json({ error: 'Missing parameters' })
  }
  
  res.status(405).json({ error: 'Method not allowed' })
}