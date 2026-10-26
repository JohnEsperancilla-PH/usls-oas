export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div>
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-4 w-64 rounded mt-2" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="skeleton h-5 flex-1 rounded" />
            <div className="skeleton h-5 w-24 rounded hidden sm:block" />
            <div className="skeleton h-5 w-32 rounded hidden sm:block" />
            <div className="skeleton h-5 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
