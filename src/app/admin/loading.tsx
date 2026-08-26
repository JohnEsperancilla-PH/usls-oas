export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary py-4">
        <div className="container mx-auto px-4">
          <div className="skeleton h-6 w-32 bg-white/20" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          <div className="skeleton h-8 w-48" />
          <div className="card space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-5 flex-1" />
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-5 w-32" />
                <div className="skeleton h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
