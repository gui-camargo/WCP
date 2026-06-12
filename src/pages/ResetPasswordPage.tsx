import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import logo from '@/assets/logo.png'

export default function ResetPasswordPage() {
  const { updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validToken, setValidToken] = useState(true)

  useEffect(() => {
    // Verificar se o usuário foi redirecionado pelo Supabase (tem token na URL)
    const hash = window.location.hash
    if (!hash.includes('access_token') && !hash.includes('type=recovery')) {
      setValidToken(false)
      setError('Link de reset inválido ou expirado. Solicite um novo reset.')
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('As senhas não conferem.')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    setLoading(true)
    console.info('[ResetPassword] submit:start')

    const { error } = await updatePassword(password)

    if (error) {
      console.error('[ResetPassword] submit:error', { error })
      setError('Não conseguimos atualizar sua senha. Tente novamente.')
      setLoading(false)
    } else {
      console.info('[ResetPassword] submit:success')
      setSuccess(true)
      setPassword('')
      setConfirmPassword('')
      
      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        void signOut()
        navigate('/login', { replace: true })
      }, 3000)
    }
  }

  if (!validToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-accent-600 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -ml-48 -mb-48" />
        
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 relative z-10 text-center">
          <img src={logo} alt="Bolão Logo" className="h-40 w-40 mx-auto object-contain drop-shadow-lg mb-8" />
          <p className="text-red-600 font-medium mb-6">{error}</p>
          <a
            href="/esqueceu-senha"
            className="inline-block bg-gradient-to-r from-brand-600 to-accent-500 hover:from-brand-700 hover:to-accent-600 text-white font-semibold py-2 px-6 rounded-lg transition shadow-lg hover:shadow-xl"
          >
            Solicitar novo reset
          </a>
        </div>
      </div>
    )
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

        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">Resetar senha</h1>
        <p className="text-gray-600 text-center text-sm mb-8">
          Digite sua nova senha abaixo.
        </p>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-800 text-sm mb-4">
              ✓ Senha atualizada com sucesso!
            </p>
            <p className="text-gray-600 text-xs">
              Redirecionando para login em alguns segundos...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-600 to-accent-500 hover:from-brand-700 hover:to-accent-600 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 shadow-lg hover:shadow-xl"
            >
              {loading ? 'Atualizando...' : 'Atualizar senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
