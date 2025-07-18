'use client'

export default function ActionButtons({ id, onPublish }: { id: string, onPublish: (id: string) => void }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onPublish(id)}
        className="text-white bg-green-600 hover:bg-green-700 px-3 py-1 text-sm rounded"
      >
        Publicar
      </button>
    </div>
  )
}
