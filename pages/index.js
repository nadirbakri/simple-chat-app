import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const [userId, setUserId] = useState('')
  const router = useRouter()

  useEffect(() => {
    const savedUserId = localStorage.getItem('chatUserId')
    if (savedUserId) {
      router.push('/chat')
    }
  }, [router])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (userId.trim()) {
      localStorage.setItem('chatUserId', userId.trim())
      router.push('/chat')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">
          💬 Simple Chat
        </h1>
        <p className="text-center text-gray-600 mb-6 text-sm">
          Real-time chat
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Masukkan ID Anda
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              placeholder="Contoh: Nadir Bakri"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 transform hover:scale-105"
          >
            Masuk Chat
          </button>
        </form>
      </div>
    </div>
  )
}