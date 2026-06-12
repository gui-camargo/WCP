import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import logo from '@/assets/logo.png'

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    console.info('[ForgotPassword] submit:start', { email })

    const { error } = await resetPasswordForEmail(email)

    if (error) {
      console.error('[ForgotPassword] submit:error', { email, error })
      setError('Não conseguimos enviar o email de reset. Tente novamente.')
      setLoading(false)
    } else {
      console.info('[ForgotPassword] submit:success', { email })
      setSuccess(true)
      setEmail('')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-accent-600 px-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -ml-48 -mb-48" />
      
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 relative z-10">
        <div className="text-center mb-12">
          <img src={logo} alt="Bolão Logo" className="h-40 w-40 mx-auto object-contain drop-shadow-lg" />
        </div>

        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">Esqueceu sua senha?</h1>
        <p className="text-gray-600 text-center text-sm mb-8">
          Digite seu email e enviaremos um link para resetar sua senha.
        </p>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-800 text-sm mb-4">
              ✓ Email enviado com sucesso! Verifique sua caixa de entrada e siga o link para resetar sua senha.
            </p>
            <p className="text-gray-600 text-xs mb-6">
              (Se não receber em alguns minutos, verifique a pasta de spam)
            </p>
            <Link
              to="/login"
              className="text-brand-600 font-medium hover:underline text-sm"
            >
              Voltar para login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                placeholder="seu@email.com"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-600 to-accent-500 hover:from-brand-700 hover:to-accent-600 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 shadow-lg hover:shadow-xl"
            >
              {loading ? 'Enviando...' : 'Enviar link de reset'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            Voltar para login
          </Link>
        </p>
      </div>
    </div>
  )
}
