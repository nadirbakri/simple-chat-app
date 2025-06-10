export default function UnreadBadge({ count, size = 'normal' }) {
  if (!count || count === 0) return null
  
  const sizeClasses = {
    small: 'w-4 h-4 text-xs',
    normal: 'w-5 h-5 text-xs',
    large: 'w-6 h-6 text-sm'
  }
  
  const displayCount = count > 99 ? '99+' : count.toString()
  
  return (
    <div className={`
      ${sizeClasses[size]} 
      bg-red-500 text-white 
      rounded-full 
      flex items-center justify-center 
      font-bold 
      animate-pulse
      border-2 border-white
      shadow-lg
    `}>
      {displayCount}
    </div>
  )
}