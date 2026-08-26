export default function BookLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 py-4">
        <div className="container mx-auto px-4">
          <div className="skeleton h-6 w-48" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex justify-center gap-4">
            <div className="skeleton h-8 w-8 rounded-full" />
            <div className="skeleton h-8 w-8 rounded-full" />
          </div>
          <div className="card space-y-4">
            <div className="skeleton h-6 w-40" />
            <div className="skeleton h-12 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-12 w-full" />
            </div>
            <div className="skeleton h-32 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
