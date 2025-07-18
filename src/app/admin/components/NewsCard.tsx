import StatusBadge from './StatusBadge'
import ActionButtons from './ActionButtons'

type News = {
  id: string
  title: string
  content: string
  image_url: string
  created_at: string
  status: string
}

export default function NewsCard({ news, onPublish }: { news: News, onPublish: (id: string) => void }) {
  return (
    <div className="bg-white p-4 rounded shadow-sm border mb-4 flex gap-4">
      <img src={news.image_url} alt="imagen" className="w-40 h-28 object-cover rounded" />
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h2 className="text-lg font-semibold">{news.title}</h2>
          <StatusBadge status={news.status} />
        </div>
        <p className="text-sm mt-1 line-clamp-3">{news.content}</p>
        <div className="mt-3">
          <ActionButtons id={news.id} onPublish={onPublish} />
        </div>
      </div>
    </div>
  )
}
