interface LoadingSkeletonProps {
  type?: 'card' | 'chart' | 'list' | 'text';
  count?: number;
  height?: string;
}

export default function LoadingSkeleton({ type = 'card', count = 1, height }: LoadingSkeletonProps) {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className="bg-white rounded-xl p-4 shadow-md animate-pulse" style={{ height }}>
            <div className="h-6 bg-gray-200 rounded mb-3 w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        );

      case 'chart':
        return (
          <div className="bg-white rounded-xl p-4 shadow-md animate-pulse" style={{ height: height || '300px' }}>
            <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="h-full bg-gray-200 rounded"></div>
          </div>
        );

      case 'list':
        return (
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm animate-pulse">
            <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        );

      default:
        return <div className="bg-gray-200 rounded animate-pulse" style={{ height }}></div>;
    }
  };

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{renderSkeleton()}</div>
      ))}
    </div>
  );
}
