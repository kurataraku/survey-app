'use client';

interface StepperProps {
  currentStep: number;
  totalSteps: number;
}

const stepLabels = {
  1: 'あなたについて',
  2: '学校について',
  3: '満足度',
};

export default function Stepper({ currentStep, totalSteps }: StepperProps) {
  return (
    <div className="mb-8">
      <div className="relative flex items-center justify-between px-8">
        {/* ステップ */}
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex flex-col items-center relative z-10 flex-1">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300"
              style={{
                fontFamily: 'var(--ce-font-body)',
                ...(step < currentStep
                  ? {
                      backgroundColor: 'var(--ce-primary)',
                      color: 'var(--ce-surface)'
                    }
                  : step === currentStep
                  ? {
                      backgroundColor: 'var(--ce-primary)',
                      color: 'var(--ce-surface)',
                      boxShadow: '0 0 0 4px rgba(0, 191, 99, 0.1)'
                    }
                  : {
                      backgroundColor: 'var(--ce-border)',
                      color: 'var(--ce-muted)'
                    })
              }}
            >
              {step < currentStep ? '✓' : step}
            </div>
            <div className="mt-2 text-sm font-medium" style={{ 
              fontFamily: 'var(--ce-font-body)',
              color: 'var(--ce-text)'
            }}>
              {stepLabels[step as keyof typeof stepLabels]}
            </div>
          </div>
        ))}
        
        {/* 接続線（Step1からStep2まで） */}
        <div
          className="absolute top-5 h-1 z-0"
          style={{
            left: 'calc(16.67% + 1.25rem)',
            width: 'calc(33.33% - 2.5rem)',
            backgroundColor: 2 <= currentStep ? 'var(--ce-primary)' : 'var(--ce-border)'
          }}
        />
        {/* 接続線（Step2からStep3まで） */}
        <div
          className="absolute top-5 h-1 z-0"
          style={{
            left: 'calc(50% + 1.25rem)',
            width: 'calc(33.33% - 2.5rem)',
            backgroundColor: 3 <= currentStep ? 'var(--ce-primary)' : 'var(--ce-border)'
          }}
        />
      </div>
      {/* バッジ（ステップの直下に表示） */}
      <div className="flex justify-center mt-4">
        <div className="px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap border" style={{ 
          fontFamily: 'var(--ce-font-body)',
          backgroundColor: 'var(--ce-success-bg)',
          color: 'var(--ce-text)',
          borderColor: 'var(--ce-border)'
        }}>
          全3ステップ（約3〜5分）
        </div>
      </div>
    </div>
  );
}


