import UnreadBadge from './UnreadBadge'

export default function ChatList({ chats, currentChat, onChatSelect, onAddChat, isHidden }) {
  const totalUnread = chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0)

  return (
    <div className={`
      ${isHidden ? 'hidden md:flex' : 'flex md:flex'} 
      w-full md:w-80 flex-col bg-white border-r border-gray-300 h-full
    `}>
      <div className="p-3 md:p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base md:text-lg font-semibold text-gray-800 flex items-center">
            💬 Chats
            {totalUnread > 0 && (
              <UnreadBadge count={totalUnread} size="small" />
            )}
          </h2>
          <button
            onClick={onAddChat}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white p-2 rounded-lg transition duration-200 shadow-sm"
            title="Tambah Chat Baru"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-sm font-medium">Belum ada chat</p>
            <p className="text-xs mt-1">Tap + untuk menambah chat baru</p>
          </div>
        ) : (
          chats.map((chat) => {
            const isActive = currentChat?.id === chat.id
            const hasUnread = chat.unreadCount > 0
            
            return (
              <div
                key={chat.id}
                onClick={() => onChatSelect(chat)}
                className={`
                  p-3 md:p-4 border-b border-gray-100 cursor-pointer transition-all duration-200 relative
                  hover:bg-gray-50 active:bg-gray-100
                  ${isActive ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-l-blue-500' : ''}
                  ${hasUnread ? 'bg-yellow-50' : ''}
                `}
              >
                <div className="flex items-center">
                  <div className="relative mr-3 flex-shrink-0">
                    <div className={`
                      w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-semibold text-xs md:text-base
                      ${isActive 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-700 ring-2 ring-blue-300' 
                        : 'bg-gradient-to-r from-gray-400 to-gray-600'
                      }
                      ${hasUnread ? 'ring-2 ring-yellow-400 animate-pulse' : ''}
                    `}>
                      {chat.name.charAt(0).toUpperCase()}
                    </div>
                    {hasUnread && (
                      <div className="absolute -top-1 -right-1">
                        <UnreadBadge count={chat.unreadCount} size="small" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`
                        text-sm md:text-base font-medium truncate
                        ${isActive ? 'text-blue-700' : 'text-gray-800'}
                        ${hasUnread ? 'font-bold' : ''}
                      `}>
                        {chat.name}
                      </h3>
                      {chat.lastMessageTime && (
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {new Date(chat.lastMessageTime).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                    
                    {chat.lastMessage && (
                      <p className={`
                        text-xs md:text-sm text-gray-600 truncate
                        ${hasUnread ? 'font-semibold text-gray-800' : ''}
                      `}>
                        {chat.lastMessage}
                      </p>
                    )}
                    
                    {hasUnread && (
                      <div className="flex items-center mt-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                        <span className="text-xs text-red-600 font-medium">
                          {chat.unreadCount} pesan belum dibaca
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-600 rounded-r-full"></div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}