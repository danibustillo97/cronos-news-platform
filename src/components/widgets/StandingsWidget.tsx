'use client'

const dummyTable = [
  { team: 'Real Madrid', pts: 85 },
  { team: 'Barcelona', pts: 80 },
  { team: 'Atletico Madrid', pts: 75 },
  { team: 'Sevilla', pts: 70 }
]

const StandingsWidget = () => {
  return (
    <div className="bg-neutral-900 rounded-2xl p-4 shadow-lg">
      <h2 className="text-white text-lg font-semibold mb-3">Clasificación LaLiga</h2>

      <ul className="space-y-2">
        {dummyTable.map((t, i) => (
          <li
            key={i}
            className="flex justify-between text-sm text-white px-2 py-1 rounded-md hover:bg-neutral-800"
          >
            <span>{i + 1}. {t.team}</span>
            <span className="font-bold">{t.pts} pts</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default StandingsWidget
