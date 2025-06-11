import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
})

api.interceptors.request.use(
    (config) => {
        console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data)
        return config
    },
    (error) => {
        console.error('❌ Request Error:', error)
        return Promise.reject(error)
    }
)

api.interceptors.response.use(
    (response) => {
        console.log(`✅ API Response: ${response.config.url}`, response.data)
        return response
    },
    (error) => {
        const errorMessage = error.response?.data?.error || error.message
        console.error(`❌ API Error: ${error.config?.url}`, errorMessage)
        return Promise.reject(error)
    }
)

export const chatAPI = {
    register: async (userId, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await api.post('/chat-redis', {
                    action: 'register', 
                    userId 
                })
                return response.data
            } catch (error) {
                console.log(`❌ Register attempt ${i + 1}/${retries} failed`)
                if (i === retries - 1) throw error
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }
    },
    
    searchUser: async (userId, searchId) => {
        const response = await api.post('/chat-redis', {
            action: 'search', 
            userId, 
            data: { searchId } 
        })
        return response.data
    },
    
    sendMessage: async (from, to, message) => {
        const response = await api.post('/chat-redis', {
            action: 'send', 
            userId: from,
            data: { from, to, message } 
        })
        return response.data
    },
    
    markAsRead: async (userId, chatWith) => {
        const response = await api.post('/chat-redis', {
            action: 'mark_read',
            userId,
            data: { chatWith }
        })
        return response.data
    },
    
    setTyping: async (userId, chatWith, isTyping) => {
        const response = await api.post('/chat-redis', {
            action: 'typing',
            userId,
            data: { chatWith, isTyping }
        })
        return response.data
    },
    
    getTypingStatus: async (userId, chatWith) => {
        const response = await api.get(`/chat-redis?userId=${userId}&chatWith=${chatWith}&getTyping=true`)
        return response.data
    },
    
    getChats: async (userId) => {
        const response = await api.get(`/chat-redis?userId=${userId}`)
        return response.data
    },
    
    getMessages: async (userId, chatWith) => {
        const response = await api.get(`/chat-redis?userId=${userId}&chatWith=${chatWith}`)
        return response.data
    }
}