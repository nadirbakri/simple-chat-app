import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Add retry logic
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config
        
        // If no retry count, set it
        if (!config._retryCount) {
            config._retryCount = 0
        }
        
        // Max 3 retries for network errors
        if (config._retryCount < 3 && 
            (error.code === 'ECONNABORTED' || 
             error.code === 'ERR_NETWORK' ||
             !error.response)) {
            
            config._retryCount++
            
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, config._retryCount - 1), 5000)
            
            console.log(`🔄 Retrying request (attempt ${config._retryCount}/3) after ${delay}ms`)
            
            await new Promise(resolve => setTimeout(resolve, delay))
            
            return api(config)
        }
        
        return Promise.reject(error)
    }
)

api.interceptors.request.use(
    (config) => {
        const method = config.method?.toUpperCase() || 'UNKNOWN'
        const url = config.url || 'unknown-url'
        console.log(`🔄 API Request: ${method} ${url}`)
        
        if (config.data && config.url !== '/chat-redis') {
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
        
        // Don't log typing requests to reduce noise
        if (url !== '/chat-redis' || !response.config?.params?.getTyping) {
            console.log(`✅ API Response: ${url} (${status})`)
            
            if (response.data && url !== '/chat-redis') {
                console.log('📥 Response data:', response.data)
            }
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
        
        try {
            const response = await api.post('/chat-redis', {
                action: 'register', 
                userId: userId.trim()
            })
            
            console.log(`✅ Registration successful for: ${userId}`)
            return response.data
        } catch (error) {
            console.error(`❌ Registration failed for: ${userId}`, error.message)
            throw error
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
            
            console.log(`⌨️ API Call: setTyping(${userId}, ${chatWith}, ${isTyping})`)
            
            const response = await api.post('/chat-redis', {
                action: 'typing',
                userId: userId.trim(),
                data: { 
                    chatWith: chatWith.trim(), 
                    isTyping: Boolean(isTyping) 
                }
            }, {
                timeout: 8000, // 8 second timeout for typing
                _retryCount: 1 // Only 1 retry for typing
            })
            
            console.log(`⌨️ API Response: setTyping success`, response.data)
            return response.data
        } catch (error) {
            console.warn('⚠️ Typing indicator API failed (non-critical):', error.message)
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
            
            console.log(`⌨️ API Call: getTypingStatus(${userId}, ${chatWith})`)
            
            const response = await api.get(
                `/chat-redis?getTyping=true&userId=${encodeURIComponent(userId.trim())}&chatWith=${encodeURIComponent(chatWith.trim())}`,
                {
                    timeout: 8000, // 8 second timeout for typing
                    _retryCount: 1 // Only 1 retry for typing
                }
            )
            
            console.log(`⌨️ API Response: getTypingStatus`, {
                isTyping: response.data.isTyping,
                typingUsers: response.data.typingUsers,
                debug: response.data.debug
            })
            
            return response.data
        } catch (error) {
            console.warn('⚠️ Get typing status API failed (non-critical):', error.message)
            return { isTyping: false, typingUsers: [], error: error.message }
        }
    }
}