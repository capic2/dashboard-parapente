import React, { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSites } from '../hooks/useSites'
import { useUpdateSite, useDeleteSite, SiteUpdate } from '../hooks/useSiteMutations'
import { Site } from '../hooks/useFlight'
import { SiteCard } from '../components/SiteCard'
import { EditSiteModal } from '../components/EditSiteModal'

export const Sites: React.FC = () => {
  const navigate = useNavigate()
  const { data: sites = [], isLoading, error } = useSites()
  const updateSite = useUpdateSite()
  const deleteSite = useDeleteSite()
  
  // Filters & search
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'takeoff' | 'landing' | 'both'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'region'>('name')
  
  // Modals
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  // Filter & sort logic
  const filteredSites = useMemo(() => {
    let filtered = sites.filter(site => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.region?.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Type filter
      const matchesType = typeFilter === 'all' || site.usage_type === typeFilter
      
      return matchesSearch && matchesType
    })
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'region':
          return (a.region || '').localeCompare(b.region || '')
        default:
          return 0
      }
    })
    
    return filtered
  }, [sites, searchQuery, typeFilter, sortBy])
  
  // Handlers
  const handleEdit = (site: Site) => {
    setEditingSite(site)
    setIsEditModalOpen(true)
  }
  
  const handleCreate = () => {
    setEditingSite(null)
    setIsEditModalOpen(true)
  }
  
  const handleSave = async (data: SiteUpdate) => {
    if (editingSite) {
      // Edit mode
      await updateSite.mutateAsync({ siteId: editingSite.id, data })
    } else {
      // Create mode - would need a createSite mutation
      // For now, this would use the existing CreateSiteModal workflow
      console.log('Create site:', data)
      alert('La création de sites est disponible via le bouton "Nouveau site" dans l\'historique des vols')
    }
  }
  
  const handleDelete = async (site: Site) => {
    if (!confirm(`Supprimer le site "${site.name}" ?\n\nCette action est irréversible.`)) {
      return
    }
    
    try {
      await deleteSite.mutateAsync(site.id)
      alert(`Site "${site.name}" supprimé avec succès`)
    } catch (error: any) {
      const errorMessage = error?.message || 'Erreur lors de la suppression'
      alert(errorMessage)
    }
  }
  
  const handleViewFlights = (site: Site) => {
    navigate(`/history?site=${site.id}`)
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          ❌ Erreur lors du chargement des sites
        </div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Gestion des Sites</h1>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          ➕ Nouveau site
        </button>
      </div>
      
      {/* Filters Bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, code ou région..."
            className="px-3 py-2 border rounded"
          />
          
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border rounded"
          >
            <option value="all">Tous les types</option>
            <option value="takeoff">Décollage uniquement</option>
            <option value="landing">Atterrissage uniquement</option>
            <option value="both">Déco/Atterro</option>
          </select>
          
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border rounded"
          >
            <option value="name">Trier par nom</option>
            <option value="region">Trier par région</option>
          </select>
        </div>
      </div>
      
      {/* Results count */}
      <p className="text-sm text-gray-600 mb-4">
        {filteredSites.length} site{filteredSites.length !== 1 ? 's' : ''} trouvé{filteredSites.length !== 1 ? 's' : ''}
      </p>
      
      {/* Sites Grid */}
      {filteredSites.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSites.map(site => (
            <SiteCard
              key={site.id}
              site={site}
              flightCount={0}  // TODO: could fetch from API if needed
              onEdit={handleEdit}
              onDelete={handleDelete}
              onViewFlights={handleViewFlights}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">Aucun site trouvé</p>
          {searchQuery || typeFilter !== 'all' ? (
            <p className="text-gray-400">Essayez de modifier vos filtres de recherche</p>
          ) : (
            <button
              onClick={handleCreate}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              ➕ Créer votre premier site
            </button>
          )}
        </div>
      )}
      
      {/* Edit Modal */}
      <EditSiteModal
        site={editingSite}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingSite(null)
        }}
        onSave={handleSave}
      />
    </div>
  )
}
