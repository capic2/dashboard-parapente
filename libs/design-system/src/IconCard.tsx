import { tv } from 'tailwind-variants';

const iconCard = tv({
  base: 'flex flex-col items-center p-3 border-2 rounded-lg relative overflow-hidden',
  variants: {
    unlocked: {
      true: 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border-sky-300 dark:border-sky-600 hover:shadow-md transition-shadow',
      false: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700',
    },
  },
});

const iconStyle = tv({
  base: 'text-3xl mb-1',
  variants: {
    unlocked: {
      true: '',
      false: 'opacity-40 grayscale',
    },
  },
});

const titleStyle = tv({
  base: 'text-xs font-semibold text-center',
  variants: {
    unlocked: {
      true: 'text-gray-800 dark:text-gray-100',
      false: 'text-gray-500 dark:text-gray-400',
    },
  },
});

const descriptionStyle = tv({
  base: 'text-xs text-center mt-1',
  variants: {
    unlocked: {
      true: 'text-gray-600 dark:text-gray-300',
      false: 'text-gray-400 dark:text-gray-500',
    },
  },
});

interface IconCardProps {
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress?: number; // 0-100
}

export function IconCard({
  icon,
  title,
  description,
  unlocked,
  progress,
}: IconCardProps) {
  const content = (
    <>
      <span className={iconStyle({ unlocked })}>{icon}</span>
      <span className={titleStyle({ unlocked })}>{title}</span>
      <span className={descriptionStyle({ unlocked })}>{description}</span>
      {!unlocked && progress !== undefined && progress > 0 && (
        <span className="text-xs text-sky-600 dark:text-sky-400 font-medium mt-1">
          {Math.round(progress)}%
        </span>
      )}
    </>
  );

  return (
    <div className={iconCard({ unlocked })}>
      {!unlocked && progress !== undefined && (
        <div
          className="absolute inset-0 bg-gradient-to-t from-sky-100 dark:from-sky-900/30 to-transparent opacity-50"
          style={{
            height: `${progress}%`,
            bottom: 0,
            top: 'auto',
          }}
        ></div>
      )}

      {unlocked ? content : <div className="relative z-10 flex flex-col items-center">{content}</div>}
    </div>
  );
}
