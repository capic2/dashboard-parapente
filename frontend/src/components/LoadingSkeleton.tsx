import './LoadingSkeleton.css';

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
          <div className="skeleton-card" style={{ height }}>
            <div className="skeleton-header"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
          </div>
        );

      case 'chart':
        return (
          <div className="skeleton-chart" style={{ height: height || '300px' }}>
            <div className="skeleton-title"></div>
            <div className="skeleton-graph"></div>
          </div>
        );

      case 'list':
        return (
          <div className="skeleton-list-item">
            <div className="skeleton-circle"></div>
            <div className="skeleton-text-group">
              <div className="skeleton-line"></div>
              <div className="skeleton-line short"></div>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="skeleton-text">
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
          </div>
        );

      default:
        return <div className="skeleton-box" style={{ height }}></div>;
    }
  };

  return (
    <div className="loading-skeleton">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{renderSkeleton()}</div>
      ))}
    </div>
  );
}
