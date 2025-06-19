import { useState, useEffect, useRef } from 'react'
import { chatAPI } from '../lib/api'

export default function ChatWindow({ chat, messages, onSendMessage, onMarkAsRead, currentUserId, onBackToList }) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [lastTypingCheck, setLastTypingCheck] = useState(0)
  const messagesEndRef = useRef(null)
  const typingCheckIntervalRef = useRef(null)
  const typingDebounceRef = useRef(null)
  const lastTypingStateRef = useRef(false)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const checkTypingStatus = async () => {
    if (!chat || !currentUserId) return
    
    try {
      const now = Date.now()
      const data = await chatAPI.getTypingStatus(currentUserId, chat.id)
      
      if (data.isTyping && data.typingUsers?.length > 0) {
        setOtherUserTyping(true)
        setLastTypingCheck(now)
      } else {
        const timeSinceLastCheck = now - lastTypingCheck
        if (timeSinceLastCheck > 2000) {
          setOtherUserTyping(false)
        }
      }
    } catch (error) {
      setOtherUserTyping(false)
    }
  }

  useEffect(() => {
    if (!chat || !currentUserId) {
      setOtherUserTyping(false)
      if (typingCheckIntervalRef.current) {
        clearInterval(typingCheckIntervalRef.current)
      }
      return
    }
    
    checkTypingStatus()
    typingCheckIntervalRef.current = setInterval(checkTypingStatus, 300)
    
    return () => {
      if (typingCheckIntervalRef.current) {
        clearInterval(typingCheckIntervalRef.current)
      }
    }
  }, [chat?.id, currentUserId])

  const handleTyping = async (typing) => {
    if (!chat || !currentUserId) return
    
    if (lastTypingStateRef.current === typing) return
    lastTypingStateRef.current = typing
    
    try {
      await chatAPI.setTyping(currentUserId, chat.id, typing)
    } catch (err) {
      
    }
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    setMessage(value)
    
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current)
    }
    
    if (value.length > 0) {
      if (!isTyping) {
        setIsTyping(true)
        handleTyping(true)
      }
      
      typingDebounceRef.current = setTimeout(() => {
        setIsTyping(false)
        handleTyping(false)
      }, 1500)
    } else {
      setIsTyping(false)
      handleTyping(false)
    }
  }

  const handleSubmit = async () => {
    if (message.trim() && chat && !sendingMessage) {
      setSendingMessage(true)
      
      setIsTyping(false)
      handleTyping(false)
      
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current)
      }
      
      try {
        await onSendMessage(message.trim())
        setMessage('')
        if (inputRef.current) {
          inputRef.current.focus()
        }
      } catch (error) {
        alert('Failed to send message. Please try again.')
      } finally {
        setSendingMessage(false)
      }
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current)
      }
      if (typingCheckIntervalRef.current) {
        clearInterval(typingCheckIntervalRef.current)
      }
      if (chat && currentUserId && isTyping) {
        handleTyping(false)
      }
    }
  }, [])

  useEffect(() => {
    if (chat && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.from !== currentUserId) {
        onMarkAsRead(chat.id)
      }
    }
  }, [chat, messages, onMarkAsRead, currentUserId])

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="text-center text-gray-500">
          <div className="text-4xl md:text-6xl mb-4">💬</div>
          <p className="text-base md:text-lg font-medium">Pilih chat untuk memulai percakapan</p>
          <p className="text-xs md:text-sm mt-2">Real-time dengan typing indicators</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="p-3 md:p-4 bg-white border-b border-gray-300 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0 flex-1">
            <button
              onClick={onBackToList}
              className="md:hidden mr-3 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold mr-2 md:mr-3 flex-shrink-0">
              {chat.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-800 text-sm md:text-base truncate">{chat.name}</h3>
              {otherUserTyping ? (
                <p className="text-xs md:text-sm text-blue-600 animate-pulse flex items-center">
                  <span className="mr-1">⌨️</span>
                  <span>sedang mengetik...</span>
                  <div className="flex space-x-1 ml-1 md:ml-2">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </p>
              ) : (
                <p className="text-xs md:text-sm text-green-500">● Online</p>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500 flex-shrink-0 ml-2">
            {messages.length} pesan
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-gradient-to-b from-gray-50 to-white">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-3xl md:text-4xl mb-2">👋</div>
            <p className="text-sm md:text-base">Belum ada pesan. Mulai percakapan!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.from === currentUserId
            
            return (
              <div
                key={msg.id}
                className={`mb-3 md:mb-4 flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[280px] md:max-w-xs lg:max-w-md px-3 md:px-4 py-2 rounded-lg transition-all duration-300
                    ${isOwn
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                    }
                  `}
                >
                  <p className="text-sm break-words">{msg.message}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {isOwn && (
                      <span className="text-xs opacity-70">✓</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}

        {otherUserTyping && (
          <div className="mb-3 md:mb-4 flex justify-start">
            <div className="bg-gray-200 text-gray-600 px-3 md:px-4 py-2 rounded-lg max-w-[200px] md:max-w-xs animate-pulse">
              <div className="flex items-center space-x-2">
                <span className="text-xs md:text-sm font-medium">{chat.name}</span>
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 md:p-4 bg-white border-t border-gray-300">
        {isTyping && (
          <div className="text-xs text-blue-600 mb-2 animate-pulse flex items-center">
            <span className="mr-2">⌨️</span>
            <span>Mengetik...</span>
            <div className="flex space-x-1 ml-2">
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        )}
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Ketik pesan..."
            disabled={sendingMessage}
            className="flex-1 px-3 md:px-4 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white transition-all duration-200 disabled:opacity-50 text-sm md:text-base"
          />
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || sendingMessage}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-4 md:px-6 py-2.5 md:py-2 rounded-lg transition duration-200 disabled:cursor-not-allowed text-sm md:text-base font-medium"
          >
            {sendingMessage ? (
              <span className="flex items-center">
                <span className="animate-spin mr-1 md:mr-2">⏳</span>
                <span className="hidden md:inline">Kirim</span>
              </span>
            ) : (
              <>
                <span className="md:hidden">📤</span>
                <span className="hidden md:inline">Kirim</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}