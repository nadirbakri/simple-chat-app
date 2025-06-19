import axios from 'axios'

const API_BASE = '/api/chat-redis'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response && error.config && !error.config._retry) {
      error.config._retry = true
      await new Promise(resolve => setTimeout(resolve, 500))
      return api.request(error.config)
    }
    
    return Promise.reject(error)
  }
)

export const chatAPI = {
  register: async (userId) => {
    try {
      const response = await api.post('', {
        action: 'register',
        userId: userId.trim()
      })
      return response.data
    } catch (error) {
      throw new Error(`Registration failed: ${error.response?.data?.error || error.message}`)
    }
  },

  searchUser: async (userId, searchId) => {
    try {
      const response = await api.post('', {
        action: 'search',
        userId: userId.trim(),
        data: { searchId: searchId.trim() }
      })
      return response.data
    } catch (error) {
      throw new Error(`Search failed: ${error.response?.data?.error || error.message}`)
    }
  },

  sendMessage: async (from, to, message) => {
    try {
      const response = await api.post('', {
        action: 'send',
        userId: from.trim(),
        data: {
          from: from.trim(),
          to: to.trim(),
          message: message.trim()
        }
      })
      return response.data
    } catch (error) {
      throw new Error(`Send failed: ${error.response?.data?.error || error.message}`)
    }
  },

  getChats: async (userId) => {
    try {
      const response = await api.get('', {
        params: { userId: userId.trim() }
      })
      return response.data
    } catch (error) {
      throw new Error(`Get chats failed: ${error.response?.data?.error || error.message}`)
    }
  },

  getMessages: async (userId, chatWith) => {
    try {
      const response = await api.get('', {
        params: { 
          userId: userId.trim(), 
          chatWith: chatWith.trim() 
        }
      })
      return response.data
    } catch (error) {
      throw new Error(`Get messages failed: ${error.response?.data?.error || error.message}`)
    }
  },

  markAsRead: async (userId, chatWith) => {
    try {
      const response = await api.post('', {
        action: 'mark_read',
        userId: userId.trim(),
        data: { chatWith: chatWith.trim() }
      })
      return response.data
    } catch (error) {
      throw new Error(`Mark as read failed: ${error.response?.data?.error || error.message}`)
    }
  },

  setTyping: async (userId, chatWith, isTyping) => {
    try {
      const response = await api.post('', {
        action: 'typing',
        userId: userId.trim(),
        data: { 
          chatWith: chatWith.trim(), 
          isTyping: Boolean(isTyping) 
        }
      })
      return response.data
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  getTypingStatus: async (userId, chatWith) => {
    try {
      const response = await api.get('', {
        params: { 
          userId: userId.trim(), 
          chatWith: chatWith.trim(),
          getTyping: 'true'
        }
      })
      
      return response.data
    } catch (error) {
      return { 
        isTyping: false, 
        typingUsers: [], 
        error: error.message 
      }
    }
  }
}

export const testConnection = async () => {
  try {
    const response = await api.get('', { 
      params: { userId: 'test', test: 'connection' } 
    })
    return true
  } catch (error) {
    return false
  }
}

export default chatAPI