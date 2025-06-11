import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
})

api.interceptors.request.use(
    (config) => {
        const method = config.method?.toUpperCase() || 'UNKNOWN'
        const url = config.url || 'unknown-url'
        console.log(`🔄 API Request: ${method} ${url}`)
        
        if (config.data) {
        const safeData = { ...config.data }
        if (safeData.token) safeData.token = '[REDACTED]'
        console.log('📤 Request data:', safeData)
        }
        
        return config
    },
    (error) => {
        console.error('❌ Request Error:', error.message)
        return Promise.reject(error)
    }
)

api.interceptors.response.use(
    (response) => {
        const url = response.config?.url || 'unknown-url'
        const status = response.status
        console.log(`✅ API Response: ${url} (${status})`)
        
        if (response.data) {
            console.log('📥 Response data:', response.data)
        }
        
        return response
    },
    (error) => {
        const url = error.config?.url || 'unknown-url'
        const status = error.response?.status || 'NO_STATUS'
        const errorMessage = error.response?.data?.error || error.message
        
        console.error(`❌ API Error: ${url} (${status})`, {
            error: errorMessage,
            details: error.response?.data?.details,
            requestId: error.response?.data?.requestId
        })
        
        return Promise.reject(error)
    }
)

export const chatAPI = {
    register: async (userId, retries = 3) => {
        if (!userId || userId.trim() === '') {
            throw new Error('UserId is required and cannot be empty')
        }
        
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`🔄 Register attempt ${i + 1}/${retries} for user: ${userId}`)
                
                const response = await api.post('/chat-redis', {
                    action: 'register', 
                    userId: userId.trim()
                })
                
                console.log(`✅ Registration successful for: ${userId}`)
                return response.data
            } catch (error) {
                console.log(`❌ Register attempt ${i + 1}/${retries} failed:`, error.message)
                
                if (i === retries - 1) {
                    console.error(`❌ All registration attempts failed for: ${userId}`)
                    throw error
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
            }
        }
    },
    
    searchUser: async (userId, searchId) => {
        if (!userId || userId.trim() === '') {
            throw new Error('UserId is required')
        }
        if (!searchId || searchId.trim() === '') {
            throw new Error('SearchId is required')
        }
        
        const response = await api.post('/chat-redis', {
            action: 'search', 
            userId: userId.trim(),
            data: { searchId: searchId.trim() } 
        })
        return response.data
    },
    
    sendMessage: async (from, to, message) => {
        if (!from || from.trim() === '') {
            throw new Error('From user is required')
        }
        if (!to || to.trim() === '') {
            throw new Error('To user is required')
        }
        if (!message || message.trim() === '') {
            throw new Error('Message cannot be empty')
        }
        
        const response = await api.post('/chat-redis', {
            action: 'send', 
            userId: from.trim(),
            data: { 
                from: from.trim(), 
                to: to.trim(), 
                message: message.trim() 
            } 
        })
        return response.data
    },
    
    markAsRead: async (userId, chatWith) => {
        if (!userId || !chatWith) {
            throw new Error('UserId and chatWith are required')
        }
        
        const response = await api.post('/chat-redis', {
            action: 'mark_read',
            userId: userId.trim(),
            data: { chatWith: chatWith.trim() }
        })
        return response.data
    },
    
    setTyping: async (userId, chatWith, isTyping) => {
        try {
            if (!userId || !chatWith) {
                throw new Error('UserId and chatWith are required')
            }
            
            const response = await api.post('/chat-redis', {
                action: 'typing',
                userId: userId.trim(),
                data: { 
                chatWith: chatWith.trim(), 
                isTyping: Boolean(isTyping) 
                }
            })
            return response.data
        } catch (error) {
            console.warn('⚠️ Typing indicator failed (non-critical):', error.message)
            return { success: false, error: error.message }
        }
    },
    
    getChats: async (userId) => {
        if (!userId || userId.trim() === '') {
            throw new Error('UserId is required for getting chats')
        }
        
        const response = await api.get(`/chat-redis?userId=${encodeURIComponent(userId.trim())}`)
        return response.data
    },
    
    getMessages: async (userId, chatWith) => {
        if (!userId || !chatWith) {
            throw new Error('UserId and chatWith are required')
        }
        
        const response = await api.get(
            `/chat-redis?userId=${encodeURIComponent(userId.trim())}&chatWith=${encodeURIComponent(chatWith.trim())}`
        )
        return response.data
    },
    
    getTypingStatus: async (userId, chatWith) => {
        try {
            if (!userId || !chatWith) {
                throw new Error('UserId and chatWith are required')
            }
            
            const response = await api.get(
                `/chat-redis?getTyping=true&userId=${encodeURIComponent(userId.trim())}&chatWith=${encodeURIComponent(chatWith.trim())}`
            )
            return response.data
        } catch (error) {
            console.warn('⚠️ Get typing status failed (non-critical):', error.message)
            return { isTyping: false, typingUsers: [], error: error.message }
        }
    }
}