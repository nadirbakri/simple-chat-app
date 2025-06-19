import { useState } from 'react'

export default function AddChatModal({ isOpen, onClose, onAddChat }) {
  const [searchId, setSearchId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!searchId.trim()) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await onAddChat(searchId.trim())
      setSuccess(`Chat dengan ${searchId} berhasil ditambahkan!`)
      setSearchId('')
      
      setTimeout(() => {
        setSuccess('')
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSearchId('')
    setError('')
    setSuccess('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg p-4 md:p-6 w-full max-w-md mx-4 shadow-2xl transform transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base md:text-lg font-semibold text-gray-800">
            ➕ Tambah Chat Baru
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-xl hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔍 ID User yang ingin di-chat
            </label>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full px-3 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white transition-all duration-200 text-sm md:text-base"
              placeholder="Contoh: Bakri Nadir"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center">
              <span className="mr-2">❌</span>
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center">
              <span className="mr-2">✅</span>
              {success}
            </div>
          )}

          {loading && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm flex items-center">
              <span className="mr-2 animate-spin">🔄</span>
              Mencari user...
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 md:py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition duration-200 text-sm md:text-base"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !searchId.trim()}
              className="flex-1 px-4 py-2.5 md:py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-lg transition duration-200 transform hover:scale-105 disabled:transform-none text-sm md:text-base font-medium"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2">🔄</span>
                  <span className="hidden md:inline">Mencari...</span>
                  <span className="md:hidden">...</span>
                </span>
              ) : (
                'Tambah'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}