import { useParams } from 'react-router-dom'
import BackButton from '@/components/BackButton'
import { IconDocument } from '@/components/Icons'

export default function RegulamentoPage() {
  const { poolId } = useParams()

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <BackButton to={poolId ? `/bolao/${poolId}` : '/dashboard'} label="Voltar ao Bolão" />
      </div>

      {/* Header */}
      <section className="relative px-0.5 py-0.5">
        <div className="border-b border-slate-200 pb-1.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-950 text-white flex-shrink-0">
              <IconDocument className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 leading-tight">Regulamento Bolão Copa</h1>
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-600">Regras vigentes para a edição atual.</p>
        </div>
      </section>

      {/* Regras Gerais */}
      <section className="modern-card p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">Regras Gerais</h2>
        <ol className="space-y-3 text-sm text-gray-700 leading-relaxed list-none">
          <li>
            <span className="font-semibold">1º — Inscrições: R$ 100,00.</span> Prazo de inscrição em aberto — alterações serão comunicadas no grupo oficial.
            <br />
            <span className="text-gray-500 text-xs ml-1">
              * Caso alguém ingresse no bolão após o início do campeonato, os resultados anteriores serão desconsiderados e a pontuação será contabilizada a partir da data de inscrição.
            </span>
          </li>
          <li><span className="font-semibold">2º</span> — A confirmação da participação é a confirmação do pagamento para o bolão.</li>
          <li><span className="font-semibold">3º</span> — Os participantes deverão opinar os resultados de todos os jogos dentro dos prazos pré-estabelecidos.</li>
          <li><span className="font-semibold">4º</span> — É de inteira responsabilidade dos participantes o envio dos palpites no sistema antes do prazo de cada jogo.</li>
          <li>
            <span className="font-semibold">5º</span> — Os palpites têm prazo individual por partida:{' '}
            <span className="font-semibold text-brand-700">os palpites fecham 30 minutos antes do horário oficial de cada jogo.</span>{' '}
            Palpites enviados após o fechamento não serão computados, sendo considerado o placar de 0x0 para aquela partida.
          </li>
          <li>
            <span className="font-semibold">6º</span> — Os resultados podem ser enviados com antecedência. Fica a critério do participante.
            <br />
            <span className="text-gray-500 text-xs ml-1">* A regra para envio do resultado de cada rodada é válida para todas as fases subsequentes.</span>
          </li>
          <li>
            <span className="font-semibold">7º</span> — Caso o participante não envie o palpite para o jogo, será considerado o resultado de{' '}
            <span className="font-semibold">EMPATE, com placar de 0x0</span>, para aquele palpite. Ainda assim existe a possibilidade de pontuação.
          </li>
          <li>
            <span className="font-semibold">8º</span> — Os palpites de todos os participantes poderão ser visualizados no sistema após o fechamento do prazo de envio de cada partida,
            ou seja, a partir de 30 minutos antes do horário oficial do jogo.
          </li>
          <li>
            <span className="font-semibold">9º</span> — Após a fase de grupos, existe a possibilidade da partida ser decidida na prorrogação ou disputa de pênaltis.
            Caso ocorra esse cenário, o placar considerado para o bolão é o do tempo regulamentar somado ao placar da prorrogação,
            sendo desconsiderada a disputa por pênaltis.
          </li>
        </ol>
      </section>

      {/* Palpites de Classificação */}
      <section className="modern-card p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">Palpites de Classificação (Grupos e Colocados Finais)</h2>
        <ul className="space-y-3 text-sm text-gray-700 leading-relaxed list-disc ml-5">
          <li>
            Além dos palpites de placares, o participante também deve indicar: 1º e 2º lugar de cada grupo e os colocados finais (Campeão, Vice-Campeão e 3º lugar).
          </li>
          <li>
            Os palpites de classificação têm prazo próprio, informado no sistema. Este prazo pode ser definido pelo administrador do bolão ou, automaticamente, será o cutoff da primeira partida da fase de grupos (2 horas antes).
          </li>
          <li>
            Após o encerramento do prazo de classificação, os palpites dos participantes ficam visíveis para todos os membros do bolão.
          </li>
        </ul>
      </section>

      {/* Pontuação */}
      <section className="modern-card p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">Pontuação</h2>
        <p className="text-sm text-gray-700 mb-3">
          A pontuação será computada por cada jogo e segue o seguinte critério:
          <br />
          <span className="text-xs text-gray-500">Pontuação válida para todos os jogos, até o jogo final.</span>
        </p>
        <ul className="space-y-1.5 text-sm text-gray-700 ml-3">
          <li>✦ Placar exato: <span className="font-semibold">20 pontos</span></li>
          <li>✦ Vencedor com número de gols de apenas um time correto: <span className="font-semibold">15 pontos</span></li>
          <li>✦ Vencedor somente ou empate com número de gols diferente: <span className="font-semibold">10 pontos</span></li>
          <li>✦ Somente o número de gols de um time: <span className="font-semibold">5 pontos</span></li>
        </ul>

        <p className="text-sm text-gray-700 mt-5 mb-3 font-medium">
          Pontuação Extra ao término da <span className="underline">primeira fase</span>:
        </p>
        <ul className="space-y-1.5 text-sm text-gray-700 ml-3">
          <li>✦ Colocação exata dos dois classificados de cada grupo: <span className="font-semibold">20 pontos</span></li>
          <li>✦ Os dois classificados de cada grupo, porém em posições invertidas: <span className="font-semibold">15 pontos</span></li>
          <li>✦ Um dos classificados na posição correta: <span className="font-semibold">10 pontos</span></li>
          <li>✦ Um dos classificados na posição errada: <span className="font-semibold">5 pontos</span></li>
        </ul>

        <p className="text-sm text-gray-700 mt-5 mb-3 font-medium">
          Pontuação Extra dos <span className="underline">colocados finais</span>:
        </p>
        <p className="text-xs text-gray-500 mb-2">
          A pontuação só vale para posição exata. Time em posição diferente não pontua.
        </p>
        <ul className="space-y-1.5 text-sm text-gray-700 ml-3">
          <li>✦ Campeão + Vice + 3º lugar corretos: <span className="font-semibold">50 pontos</span></li>
          <li>✦ Campeão + Vice corretos: <span className="font-semibold">45 pontos</span></li>
          <li>✦ Campeão + 3º lugar corretos: <span className="font-semibold">35 pontos</span></li>
          <li>✦ Campeão correto: <span className="font-semibold">30 pontos</span></li>
          <li>✦ Vice + 3º lugar corretos: <span className="font-semibold">20 pontos</span></li>
          <li>✦ Vice correto: <span className="font-semibold">15 pontos</span></li>
          <li>✦ 3º lugar correto: <span className="font-semibold">5 pontos</span></li>
        </ul>
      </section>

      {/* Premiação */}
      <section className="modern-card p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">Premiação</h2>
        <ul className="space-y-3 text-sm text-gray-700 leading-relaxed list-disc ml-5">
          <li>O valor integral das inscrições será revertido na premiação.</li>
          <li>
            A distribuição do valor será feita da seguinte forma:

            <div className="mt-3 space-y-3 ml-2">
              <div>
                <p className="font-semibold text-gray-700">Até 10 participantes:</p>
                <ul className="ml-3 text-gray-600">
                  <li>✦ 1º Colocado — 100%</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-700">De 11 até 20 participantes:</p>
                <ul className="ml-3 text-gray-600">
                  <li>✦ 1º Colocado — 85%</li>
                  <li>✦ 2º Colocado — 15%</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Acima de 20 participantes:</p>
                <ul className="ml-3 text-gray-600">
                  <li>✦ 1º Colocado — 70%</li>
                  <li>✦ 2º Colocado — 20%</li>
                  <li>✦ 3º Colocado — 10%</li>
                </ul>
              </div>
            </div>
          </li>
        </ul>
      </section>

      {/* Considerações */}
      <section className="modern-card p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">Considerações</h2>
        <ul className="space-y-3 text-sm text-gray-700 leading-relaxed list-disc ml-5">
          <li>
            O desempate se dará pelo número de acertos do placar exato das partidas.
            Persistindo o empate, o desempate se dará pelo maior número de acertos do vencedor com número de gols de um time.
          </li>
          <li>
            Caso seja de interesse do participante, o mesmo pode realizar mais de uma aposta,
            mediante o pagamento de taxa extra de inscrição. O mesmo terá palpites computados de forma independente para cada inscrição,
            não sendo permitida a permuta de resultado por inscrição. Porém fica restrito ao participante o recebimento de apenas uma premiação.
            <br />
            <span className="text-gray-500 text-xs ml-1">
              Caso o participante com mais de uma aposta se posicione entre os ganhadores com diversas inscrições,
              será concedido o prêmio apenas para sua melhor posição.
            </span>
          </li>
          <li>No caso de imprevistos, o caso será apurado pelos organizadores.</li>
          <li>
            Sugerimos que eventuais dúvidas sejam direcionadas antecipadamente para melhor organização do bolão.
          </li>
        </ul>
      </section>
    </div>
  )
}
