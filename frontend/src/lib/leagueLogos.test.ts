import { describe, expect, it } from 'vitest'
import { ESPN_LEAGUE_LOGO_IDS, leagueLogoUrl, monogram, monogramHue } from './leagueLogos'

describe('league logos', () => {
  it('maps the main competitions to verified ESPN logo ids', () => {
    expect(leagueLogoUrl('col.1')).toBe('https://a.espncdn.com/i/leaguelogos/soccer/500/1543.png')
    expect(leagueLogoUrl('eng.1', true)).toBe('https://a.espncdn.com/i/leaguelogos/soccer/500-dark/23.png')
    expect(leagueLogoUrl('uefa.champions')).toContain('/2.png')
    expect(leagueLogoUrl('conmebol.libertadores')).toContain('/58.png')
    expect(leagueLogoUrl('conmebol.sudamericana')).toContain('/1208.png')
    for (const id of ['col.1', 'esp.1', 'eng.1', 'ita.1', 'ger.1', 'uefa.champions', 'conmebol.libertadores', 'conmebol.sudamericana', 'arg.1', 'bra.1']) {
      expect(ESPN_LEAGUE_LOGO_IDS[id]).toBeTypeOf('number')
    }
  })

  it('never invents a logo for unknown leagues', () => {
    expect(leagueLogoUrl('mex.1')).toBeNull()
    expect(leagueLogoUrl('')).toBeNull()
    expect(leagueLogoUrl(null)).toBeNull()
  })

  it('builds readable monograms', () => {
    expect(monogram('Atlético Nacional')).toBe('AN')
    expect(monogram('Millonarios')).toBe('MI')
    expect(monogram('América de Cali')).toBe('AC')
    expect(monogram('Bodo/Glimt')).toBe('BG')
    expect(monogram('')).toBe('?')
    expect(monogramHue('Junior')).toBe(monogramHue('Junior'))
    expect(monogramHue('Junior')).toBeLessThan(360)
  })
})
