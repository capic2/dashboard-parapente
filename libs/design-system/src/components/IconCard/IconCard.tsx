import { tv } from 'tailwind-variants';

const iconCard = tv({
  slots: {
    root: 'flex flex-col items-center p-3 border-2 rounded-lg relative overflow-hidden',
    icon: 'text-3xl mb-1',
    title: 'text-xs font-semibold text-center',
    description: 'text-xs text-center mt-1',
    progress: 'text-xs text-sky-600 dark:text-sky-400 font-medium mt-1',
    progressOverlay:
      'absolute inset-0 bg-gradient-to-t from-sky-100 dark:from-sky-900/30 to-transparent opacity-50',
    lockedContent: 'relative z-10 flex flex-col items-center',
  },
  variants: {
    unlocked: {
      true: {
        root: 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border-sky-300 dark:border-sky-600 hover:shadow-md transition-shadow',
        title: 'text-gray-800 dark:text-gray-100',
        description: 'text-gray-600 dark:text-gray-300',
      },
      false: {
        root: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700',
        icon: 'opacity-40 grayscale',
        title: 'text-gray-500 dark:text-gray-400',
        description: 'text-gray-400 dark:text-gray-500',
      },
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
  const styles = iconCard({ unlocked });
  const content = (
    <>
      <span className={styles.icon()}>{icon}</span>
      <span className={styles.title()}>{title}</span>
      <span className={styles.description()}>{description}</span>
      {!unlocked && progress !== undefined && progress > 0 && (
        <span className={styles.progress()}>{Math.round(progress)}%</span>
      )}
    </>
  );

  return (
    <div className={styles.root()}>
      {!unlocked && progress !== undefined && (
        <div
          className={styles.progressOverlay()}
          style={{
            height: `${progress}%`,
            bottom: 0,
            top: 'auto',
          }}
        ></div>
      )}

      {unlocked ? (
        content
      ) : (
        <div className={styles.lockedContent()}>{content}</div>
      )}
    </div>
  );
}
