'use client';

interface StarRatingProps {
  value: string | undefined;
  onChange: (value: string) => void;
  maxStars?: number;
  hasNotApplicable?: boolean;
  notApplicableLabel?: string;
}

export default function StarRating({
  value,
  onChange,
  maxStars = 5,
  hasNotApplicable = false,
  notApplicableLabel = '該当なし',
}: StarRatingProps) {
  const currentValue = value ? parseInt(value) : 0;
  const isNotApplicable = currentValue === 6;

  const handleStarClick = (starValue: number) => {
    onChange(starValue.toString());
  };

  const handleNotApplicableClick = () => {
    onChange('6');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {Array.from({ length: maxStars }, (_, index) => {
          const starValue = index + 1;
          const isFilled = starValue <= currentValue && !isNotApplicable;

          return (
            <button
              key={starValue}
              type="button"
              onClick={() => handleStarClick(starValue)}
              className="focus:outline-none transition-transform hover:scale-110"
              aria-label={`${starValue}つ星`}
            >
              <svg
                className={`w-8 h-8 ${
                  isFilled
                    ? 'text-yellow-500 fill-yellow-500'
                    : 'text-gray-300 fill-gray-300'
                }`}
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          );
        })}
        {currentValue > 0 && currentValue <= 5 && (
          <span className="ml-2 text-base font-semibold"
          style={{ 
            fontFamily: 'var(--ce-font-body)',
            color: currentValue === 1 || currentValue === 2
              ? 'var(--ce-warning)'
              : currentValue === 4 || currentValue === 5
              ? 'var(--ce-primary)'
              : 'var(--ce-muted)'
          }}>
            {currentValue === 1 && 'とても不満'}
            {currentValue === 2 && 'やや不満'}
            {currentValue === 3 && 'どちらとも言えない'}
            {currentValue === 4 && 'やや満足'}
            {currentValue === 5 && 'とても満足'}
          </span>
        )}
      </div>
      {hasNotApplicable && (
        <button
          type="button"
          onClick={handleNotApplicableClick}
          className="px-4 py-2 border rounded-md text-sm transition-colors focus:outline-none"
          style={{
            borderRadius: 'var(--ce-radius-control)',
            fontFamily: 'var(--ce-font-body)',
            ...(isNotApplicable
              ? {
                  backgroundColor: 'var(--ce-border)',
                  borderColor: 'var(--ce-muted)',
                  color: 'var(--ce-text)'
                }
              : {
                  backgroundColor: 'var(--ce-surface)',
                  borderColor: 'var(--ce-border)',
                  color: 'var(--ce-text)'
                })
          }}
          onMouseEnter={(e) => {
            if (!isNotApplicable) {
              e.currentTarget.style.backgroundColor = 'var(--ce-bg)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isNotApplicable) {
              e.currentTarget.style.backgroundColor = 'var(--ce-surface)';
            }
          }}
        >
          {notApplicableLabel}
        </button>
      )}
    </div>
  );
}

