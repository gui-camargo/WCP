import html2canvas from 'html2canvas'

export async function exportSnapshotAsImage(
  matchId: string,
  homeTeamName: string,
  awayTeamName: string,
  matchDate: string
): Promise<void> {
  try {
    const element = document.getElementById(`snapshot-${matchId}`)
    if (!element) {
      throw new Error('Snapshot element not found')
    }

    // Generate canvas with better quality
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      imageTimeout: 0,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      allowTaint: true,
    })

    // Convert to PNG and download
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')

    // Generate filename
    const date = new Date(matchDate)
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', '')
    const filename = `palpites-${homeTeamName.toLowerCase().replace(/\s+/g, '-')}-vs-${awayTeamName.toLowerCase().replace(/\s+/g, '-')}-${dateStr}-${timeStr}.png`

    link.download = filename
    link.click()
  } catch (error) {
    console.error('[Export] Error exporting snapshot:', error)
    throw error
  }
}
