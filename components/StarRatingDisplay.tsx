'use client';

interface StarRatingDisplayProps {
  value: number | null;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function StarRatingDisplay({
  value,
  maxStars = 5,
  size = 'md',
  showLabel = false,
}: StarRatingDisplayProps) {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">評価なし</span>;
  }

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const starSize = sizeClasses[size];

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }, (_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= value;

        return (
          <svg
            key={starValue}
            className={`${starSize} ${
              isFilled
                ? 'text-yellow-500 fill-yellow-500'
                : 'text-gray-300 fill-gray-300'
            }`}
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );
      })}
      {showLabel && (
        <span className="ml-2 text-sm text-gray-600">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}














