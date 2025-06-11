import { useState, useEffect } from 'react'
import UnreadBadge from './UnreadBadge'

export default function ChatList({ chats, currentChat, onChatSelect, onAddChat }) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const getTotalUnreadCount = () => {
    return chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0)
  }

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp || !isClient) return ''
    
    const now = new Date()
    const messageTime = new Date(timestamp)
    const diffInHours = (now - messageTime) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60))
      return diffInMinutes < 1 ? 'Baru saja' : `${diffInMinutes}m`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`
    } else {
      return messageTime.toLocaleDateString('id-ID')
    }
  }

  return (
    <div className="w-1/3 bg-gray-100 border-r border-gray-300 flex flex-col">
      <div className="p-4 bg-white border-b border-gray-300">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-800">Chats</h2>
            {getTotalUnreadCount() > 0 && (
              <UnreadBadge count={getTotalUnreadCount()} size="normal" />
            )}
          </div>
          <button
            onClick={onAddChat}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-3 py-1 rounded-lg text-sm transition duration-200 transform hover:scale-105"
          >
            + Tambah
          </button>
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1">
        {chats.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <div className="text-4xl mb-2">💬</div>
            <p>Belum ada chat.</p>
            <p className="text-sm">Klik &quot;Tambah&quot; untuk memulai.</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => onChatSelect(chat)}
              className={`
                p-4 border-b cursor-pointer transition-all duration-200
                ${currentChat?.id === chat.id 
                  ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                  : chat.hasUnread 
                    ? 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 animate-pulse' 
                    : 'hover:bg-gray-50 border-gray-200'
                }
              `}
            >
              <div className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold mr-3 transition-all duration-300
                  ${chat.hasUnread 
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 shadow-lg transform scale-110' 
                    : 'bg-gradient-to-r from-blue-500 to-purple-600'
                  }
                `}>
                  {chat.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className={`
                      font-medium truncate pr-2
                      ${chat.hasUnread ? 'text-gray-900 font-bold' : 'text-gray-800'}
                    `}>
                      {chat.name}
                    </h3>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {chat.lastMessageTime && isClient && (
                        <span className={`text-xs ${chat.hasUnread ? 'text-yellow-700 font-semibold' : 'text-gray-500'}`}>
                          {formatLastMessageTime(chat.lastMessageTime)}
                        </span>
                      )}
                      {chat.hasUnread && chat.unreadCount > 0 && (
                        <UnreadBadge count={chat.unreadCount} size="small" />
                      )}
                    </div>
                  </div>
                  <p className={`
                    text-sm truncate mt-1
                    ${chat.hasUnread 
                      ? 'text-gray-700 font-semibold' 
                      : 'text-gray-500'
                    }
                  `}>
                    {chat.lastMessage || 'Belum ada pesan'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}