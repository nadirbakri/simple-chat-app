export default function UnreadBadge({ count, size = 'normal' }) {
  if (!count || count === 0) return null
  
  const sizeClasses = {
    small: 'min-w-[16px] h-4 text-[10px] px-1',
    normal: 'min-w-[20px] h-5 text-xs px-1.5',
    large: 'min-w-[24px] h-6 text-sm px-2'
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
      shadow-md
      ring-2 ring-white
      z-10
    `}>
      {displayCount}
    </div>
  )
}