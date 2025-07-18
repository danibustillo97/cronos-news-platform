export default function StatusBadge({ status }: { status: string }) {
  const color = status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>
      {status.toUpperCase()}
    </span>
  )
}
