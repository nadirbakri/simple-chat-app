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
    register: async (userId) => {
        const response = await api.post('/chat', { 
        action: 'register', 
        userId 
        })
        return response.data
    },
    
    searchUser: async (userId, searchId) => {
        const response = await api.post('/chat', { 
        action: 'search', 
        userId, 
        data: { searchId } 
        })
        return response.data
    },
    
    sendMessage: async (from, to, message) => {
        const response = await api.post('/chat', { 
        action: 'send', 
        userId: from,
        data: { from, to, message } 
        })
        return response.data
    },
    
    markAsRead: async (userId, chatWith) => {
        const response = await api.post('/chat', {
        action: 'mark_read',
        userId,
        data: { chatWith }
        })
        return response.data
    },
    
    setTyping: async (userId, chatWith, isTyping) => {
        const response = await api.post('/chat', {
        action: 'typing',
        userId,
        data: { chatWith, isTyping }
        })
        return response.data
    },
    
    getTypingStatus: async (userId, chatWith) => {
        const response = await api.get(`/chat?userId=${userId}&chatWith=${chatWith}&getTyping=true`)
        return response.data
    },
    
    getChats: async (userId) => {
        const response = await api.get(`/chat?userId=${userId}`)
        return response.data
    },
    
    getMessages: async (userId, chatWith) => {
        const response = await api.get(`/chat?userId=${userId}&chatWith=${chatWith}`)
        return response.data
    }
}