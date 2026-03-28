import preview from '../.storybook/preview';
import { expect, within } from 'storybook/test';
import { useState } from 'react';
import ErrorBoundary from './ErrorBoundary';

const meta = preview.meta({
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Error boundary component that catches JavaScript errors in child components and displays a fallback UI. Includes error details and reset functionality.',
      },
    },
  },
  tags: ['autodocs'],
});

// Component that throws an error
const BuggyComponent = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('This is a simulated error for testing ErrorBoundary');
  }
  return (
    <div className="p-4 bg-green-50 text-green-800 rounded">
      Component rendered successfully ✓
    </div>
  );
};

// Helper component for InteractiveError story
const InteractiveErrorDemo = () => {
  const [shouldError, setShouldError] = useState(false);

  return (
    <ErrorBoundary key={shouldError ? 'error' : 'ok'}>
      <div className="p-8 bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Interactive Error Test
        </h2>
        <p className="text-gray-600 mb-4">
          Click the button below to trigger an error and see the ErrorBoundary
          in action.
        </p>
        <button
          onClick={() => setShouldError(true)}
          className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
        >
          Trigger Error
        </button>
        <BuggyComponent shouldThrow={shouldError} />
      </div>
    </ErrorBoundary>
  );
};

// Helper component for MultipleComponents story
const MultipleComponentsDemo = () => {
  const [errorIndex, setErrorIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <ErrorBoundary key={errorIndex}>
        <div className="grid grid-cols-3 gap-4 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-white rounded-lg shadow">
              <h3 className="font-bold mb-2">Component {i}</h3>
              <button
                onClick={() => setErrorIndex(i)}
                className="text-sm px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Break
              </button>
              <BuggyComponent shouldThrow={errorIndex === i} />
            </div>
          ))}
        </div>
      </ErrorBoundary>
    </div>
  );
};

// Default error boundary with error
export const WithError = meta.story({
  render: () => (
    <ErrorBoundary>
      <BuggyComponent shouldThrow={true} />
    </ErrorBoundary>
  ),
});

// Test error boundary catches error
WithError.test(
  'should display error UI when error occurs',
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify error message is displayed
    await expect(
      canvas.getByText(/Une erreur est survenue/i)
    ).toBeInTheDocument();

    // Verify reset button is present
    await expect(
      canvas.getByRole('button', { name: /Réessayer/i })
    ).toBeInTheDocument();

    // Verify home button is present
    await expect(
      canvas.getByRole('button', { name: /Retour à l'accueil/i })
    ).toBeInTheDocument();
  }
);

// No error - children render normally
export const NoError = meta.story({
  name: 'No Error (Normal State)',
  render: () => (
    <ErrorBoundary>
      <div className="p-8 bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Everything is working fine!
        </h2>
        <p className="text-gray-600">
          The ErrorBoundary is active but no error has occurred, so the children
          render normally.
        </p>
      </div>
    </ErrorBoundary>
  ),
});

// Custom fallback
export const CustomFallback = meta.story({
  name: 'Custom Fallback',
  render: () => (
    <ErrorBoundary
      fallback={
        <div className="p-8 bg-red-50 border-2 border-red-200 rounded-xl">
          <h2 className="text-xl font-bold text-red-600 mb-2">
            Custom Error Message
          </h2>
          <p className="text-red-800">
            This is a custom fallback UI provided as a prop.
          </p>
        </div>
      }
    >
      <BuggyComponent shouldThrow={true} />
    </ErrorBoundary>
  ),
});

// Interactive error trigger
export const InteractiveError = meta.story({
  name: 'Interactive Error Trigger',
  render: () => <InteractiveErrorDemo />,
});

// Error with details visible
export const WithErrorDetails = meta.story({
  name: 'With Error Details',
  render: () => (
    <ErrorBoundary>
      <BuggyComponent shouldThrow={true} />
    </ErrorBoundary>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows the error boundary with technical details available in the expandable section.',
      },
    },
  },
});

// Multiple components in boundary
export const MultipleComponents = meta.story({
  name: 'Multiple Components',
  render: () => <MultipleComponentsDemo />,
});

// Nested error boundaries
export const NestedBoundaries = meta.story({
  name: 'Nested Error Boundaries',
  render: () => (
    <ErrorBoundary
      fallback={
        <div className="p-4 bg-red-100 text-red-800">
          Outer boundary caught an error
        </div>
      }
    >
      <div className="p-8 bg-gray-50 rounded-xl">
        <h2 className="text-xl font-bold mb-4">Outer Boundary</h2>
        <ErrorBoundary
          fallback={
            <div className="p-4 bg-yellow-100 text-yellow-800">
              Inner boundary caught an error
            </div>
          }
        >
          <div className="p-4 bg-white rounded-lg shadow">
            <h3 className="font-bold mb-2">Inner Boundary</h3>
            <BuggyComponent shouldThrow={true} />
          </div>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  ),
});
