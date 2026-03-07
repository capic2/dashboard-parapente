/**
 * WeatherSourceCard Component
 * Displays individual weather source configuration with stats and controls
 */

import React, { useState } from 'react'
import type { WeatherSource, WeatherSourceUpdate } from '../types/weatherSources'
import { useUpdateWeatherSource, useTestWeatherSource } from '../hooks/useWeatherSources'

interface WeatherSourceCardProps {
  source: WeatherSource
  isLastActive: boolean  // True if this is the only active source
  onDelete?: (source: WeatherSource) => void
}

export const WeatherSourceCard: React.FC<WeatherSourceCardProps> = ({
  source,
  isLastActive,
  onDelete
}) => {
  const updateSource = useUpdateWeatherSource()
  const testSource = useTestWeatherSource()
  
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyValue, setApiKeyValue] = useState('')
  const [isEditingApiKey, setIsEditingApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  
  // Status badge styling
  const getStatusBadge = () => {
    switch (source.status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">● Actif</span>
      case 'error':
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800">● Erreur</span>
      case 'disabled':
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-600">● Désactivé</span>
      case 'unknown':
        return <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">● Non testé</span>
    }
  }
  
  // Scraper type icon
  const getScraperIcon = () => {
    switch (source.scraper_type) {
      case 'api':
        return '🌐'
      case 'playwright':
        return '🎭'
      case 'stealth':
        return '🥷'
    }
  }
  
  // Toggle enabled/disabled
  const handleToggleEnabled = async () => {
    if (isLastActive && source.is_enabled) {
      alert('Impossible de désactiver la dernière source active. Au moins une source doit rester activée.')
      return
    }
    
    try {
      await updateSource.mutateAsync({
        sourceName: source.source_name,
        data: { is_enabled: !source.is_enabled }
      })
    } catch (error: any) {
      alert(`Erreur: ${error?.message || 'Impossible de modifier la source'}`)
    }
  }
  
  // Save API key
  const handleSaveApiKey = async () => {
    if (!apiKeyValue.trim()) {
      alert('Veuillez entrer une clé API')
      return
    }
    
    try {
      await updateSource.mutateAsync({
        sourceName: source.source_name,
        data: { api_key: apiKeyValue }
      })
      setIsEditingApiKey(false)
      setApiKeyValue('')
      alert('Clé API sauvegardée avec succès')
    } catch (error: any) {
      alert(`Erreur: ${error?.message || 'Impossible de sauvegarder la clé API'}`)
    }
  }
  
  // Test source
  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    
    try {
      // Use a default test location (Besançon area)
      const result = await testSource.mutateAsync({
        sourceName: source.source_name,
        lat: 47.24,
        lon: 6.02
      })
      
      if (result.success) {
        setTestResult({
          success: true,
          message: `✅ Test réussi en ${result.response_time_ms}ms`
        })
      } else {
        setTestResult({
          success: false,
          message: `❌ Échec: ${result.error || 'Erreur inconnue'}`
        })
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `❌ Erreur: ${error?.message || 'Test échoué'}`
      })
    } finally {
      setIsTesting(false)
      // Clear test result after 5 seconds
      setTimeout(() => setTestResult(null), 5000)
    }
  }
  
  // Format timestamp
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Jamais'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins}min`
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`
    return `Il y a ${Math.floor(diffMins / 1440)}j`
  }
  
  return (
    <div className={`bg-white rounded-lg shadow-md p-5 border-2 transition-all ${
      source.is_enabled ? 'border-sky-200' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{getScraperIcon()}</span>
            <h3 className="text-lg font-bold text-gray-900">{source.display_name}</h3>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-gray-600">{source.description}</p>
        </div>
        
        {/* Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer ml-3">
          <input
            type="checkbox"
            checked={source.is_enabled}
            onChange={handleToggleEnabled}
            disabled={updateSource.isPending}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sky-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
        </label>
      </div>
      
      {/* API Key Section */}
      {source.requires_api_key && (
        <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">🔑 Clé API</label>
            {source.api_key_configured ? (
              <span className="text-xs text-green-600 font-semibold">✓ Configurée</span>
            ) : (
              <span className="text-xs text-red-600 font-semibold">✗ Manquante</span>
            )}
          </div>
          
          {isEditingApiKey ? (
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder="Entrez votre clé API"
                className="flex-1 px-2 py-1 text-sm border rounded"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
              >
                {showApiKey ? '🙈' : '👁️'}
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={updateSource.isPending}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setIsEditingApiKey(false)
                  setApiKeyValue('')
                }}
                className="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
              >
                ✗
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingApiKey(true)}
              className="w-full px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50"
            >
              {source.api_key_configured ? 'Modifier la clé API' : 'Configurer la clé API'}
            </button>
          )}
          
          {source.documentation_url && (
            <a
              href={source.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline mt-1 inline-block"
            >
              📖 Documentation API
            </a>
          )}
        </div>
      )}
      
      {/* Statistics */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="p-2 bg-gray-50 rounded">
          <div className="text-xs text-gray-600">Taux succès</div>
          <div className={`text-lg font-bold ${
            source.success_rate >= 95 ? 'text-green-600' :
            source.success_rate >= 80 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {source.success_rate.toFixed(0)}%
          </div>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          <div className="text-xs text-gray-600">Temps moy</div>
          <div className="text-lg font-bold text-gray-900">
            {source.avg_response_time_ms ? `${source.avg_response_time_ms}ms` : '-'}
          </div>
        </div>
        <div className="p-2 bg-gray-50 rounded">
          <div className="text-xs text-gray-600">Appels</div>
          <div className="text-lg font-bold text-gray-900">
            {source.success_count + source.error_count}
          </div>
        </div>
      </div>
      
      {/* Last activity */}
      <div className="text-xs text-gray-600 mb-3">
        {source.last_success_at && (
          <div>✓ Dernier succès: {formatTimestamp(source.last_success_at)}</div>
        )}
        {source.last_error_at && (
          <div className="text-red-600">
            ✗ Dernière erreur: {formatTimestamp(source.last_error_at)}
            {source.last_error_message && (
              <div className="text-xs mt-1 p-1 bg-red-50 rounded truncate" title={source.last_error_message}>
                {source.last_error_message}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Test Result */}
      {testResult && (
        <div className={`mb-3 p-2 rounded text-sm ${
          testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {testResult.message}
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={isTesting || !source.is_enabled}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? '⏳ Test en cours...' : '🔍 Tester'}
        </button>
        
        {onDelete && !['open-meteo', 'weatherapi', 'meteo-parapente', 'meteociel', 'meteoblue'].includes(source.source_name) && (
          <button
            onClick={() => onDelete(source)}
            className="px-3 py-2 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  )
}
