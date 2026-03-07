import React from 'react'
import { Site } from '../hooks/useFlight'

interface SiteCardProps {
  site: Site
  flightCount?: number
  onEdit: (site: Site) => void
  onDelete: (site: Site) => void
  onViewFlights: (site: Site) => void
}

export const SiteCard: React.FC<SiteCardProps> = ({
  site,
  flightCount = 0,
  onEdit,
  onDelete,
  onViewFlights
}) => {
  // Type badge styling
  const getTypeBadge = () => {
    switch (site.usage_type) {
      case 'takeoff':
        return { label: 'Décollage', color: 'bg-green-100 text-green-800' }
      case 'landing':
        return { label: 'Atterrissage', color: 'bg-blue-100 text-blue-800' }
      case 'both':
      default:
        return { label: 'Déco/Atterro', color: 'bg-purple-100 text-purple-800' }
    }
  }
  
  const typeBadge = getTypeBadge()
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{site.name}</h3>
          {site.code && <p className="text-sm text-gray-500">Code: {site.code}</p>}
        </div>
        <span className={`px-2 py-1 text-xs font-semibold rounded ${typeBadge.color}`}>
          {typeBadge.label}
        </span>
      </div>
      
      {/* Info Grid */}
      <div className="space-y-2 mb-4">
        {/* GPS Coordinates */}
        {site.latitude && site.longitude && (
          <div className="text-sm">
            <span className="text-gray-600">📍 </span>
            <span className="text-gray-800">
              {site.latitude.toFixed(4)}°N, {site.longitude.toFixed(4)}°E
            </span>
            {site.elevation_m && (
              <span className="text-gray-600 ml-2">({site.elevation_m}m)</span>
            )}
          </div>
        )}
        
        {/* Orientation */}
        {site.orientation && (
          <div className="text-sm">
            <span className="text-gray-600">🧭 </span>
            <span className="text-gray-800">Orientation: {site.orientation}</span>
          </div>
        )}
        
        {/* Region */}
        {site.region && (
          <div className="text-sm">
            <span className="text-gray-600">🗺️ </span>
            <span className="text-gray-800">{site.region}</span>
          </div>
        )}
        
        {/* Flight count */}
        <div className="text-sm">
          <span className="text-gray-600">✈️ </span>
          <span className="text-gray-800">{flightCount} vol{flightCount !== 1 ? 's' : ''}</span>
        </div>
        
        {/* Description preview */}
        {site.description && (
          <div className="text-sm text-gray-600 italic mt-2">
            {site.description.length > 80 
              ? site.description.substring(0, 80) + '...' 
              : site.description}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t">
        <button
          onClick={() => onEdit(site)}
          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          title="Éditer le site"
        >
          ✏️ Éditer
        </button>
        <button
          onClick={() => onViewFlights(site)}
          className="flex-1 px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
          title="Voir les vols"
        >
          📋 Vols
        </button>
        <button
          onClick={() => onDelete(site)}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          title="Supprimer le site"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}
