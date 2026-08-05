'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getOpenTenders, getTenderDetails } from '../services/tenderService';
import { TenderDetails, TenderSummary, TenderStatus, ProcurementCategory } from '../types/tender';
import TenderDetailsComponent from './TenderDetails';
import BidSubmissionForm from '../../bid/components/BidSubmissionForm';
import { useAuth } from '../../../hooks/useAuth';
import {
    Search,
    Filter,
    Calendar,
    Clock,
    FileText,
    AlertCircle,
    CheckCircle,
    X,
    ChevronDown,
    Grid3X3,
    List,
    ArrowRight,
    TrendingUp,
    Package,
    Briefcase,
    Wrench
} from 'lucide-react';
import './TenderListings.css';

// Countdown hook for tender deadlines
const useCountdown = (deadline: string) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, isExpired: false });

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const deadlineTime = new Date(deadline).getTime();
            const difference = deadlineTime - now;

            if (difference <= 0) {
                return { days: 0, hours: 0, minutes: 0, isExpired: true };
            }

            return {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
                isExpired: false
            };
        };

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 60000); // Update every minute

        return () => clearInterval(timer);
    }, [deadline]);

    return timeLeft;
};

// Countdown display component
const CountdownBadge: React.FC<{ deadline: string }> = ({ deadline }) => {
    const { days, hours, minutes, isExpired } = useCountdown(deadline);

    if (isExpired) {
        return (
            <span className="tender-countdown tender-countdown--expired">
                <AlertCircle className="tender-countdown__icon" />
                Deadline passed
            </span>
        );
    }

    if (days > 7) {
        return (
            <span className="tender-countdown tender-countdown--safe">
                <Clock className="tender-countdown__icon" />
                {days} days left
            </span>
        );
    }

    if (days > 1) {
        return (
            <span className="tender-countdown tender-countdown--urgent">
                <Clock className="tender-countdown__icon" />
                {days} days left
            </span>
        );
    }

    return (
        <span className="tender-countdown tender-countdown--critical">
            <AlertCircle className="tender-countdown__icon" />
            {days > 0 ? `${days}d ` : ''}{hours}h {minutes}m
        </span>
    );
};

// Category icon mapper
const CategoryIcon: React.FC<{ category: ProcurementCategory; className?: string }> = ({ category, className }) => {
    switch (category) {
        case 'Goods':
            return <Package className={className} />;
        case 'Works':
            return <Wrench className={className} />;
        case 'Services':
            return <Briefcase className={className} />;
        default:
            return <FileText className={className} />;
    }
};

// Status badge component
const StatusBadge: React.FC<{ status: TenderStatus }> = ({ status }) => {
    const statusConfig = {
        Open: { class: 'status--open', icon: CheckCircle },
        Closed: { class: 'status--closed', icon: X },
        'Under Evaluation': { class: 'status--evaluation', icon: TrendingUp },
        Awarded: { class: 'status--awarded', icon: CheckCircle },
        Cancelled: { class: 'status--cancelled', icon: AlertCircle }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <span className={`tender-status ${config.class}`}>
            <Icon className="tender-status__icon" />
            {status}
        </span>
    );
};

// Category badge component
const CategoryBadge: React.FC<{ category: ProcurementCategory }> = ({ category }) => (
    <span className={`tender-category tender-category--${category.toLowerCase()}`}>
        <CategoryIcon category={category} className="tender-category__icon" />
        {category}
    </span>
);

// Empty state component
const EmptyState: React.FC<{ onClearFilters: () => void }> = ({ onClearFilters }) => (
    <div className="tender-empty">
        <div className="tender-empty__icon">
            <Search className="w-16 h-16" />
        </div>
        <h3 className="tender-empty__title">No tenders found</h3>
        <p className="tender-empty__message">
            Try adjusting your search or filter criteria to find what you&apos;re looking for.
        </p>
        <button onClick={onClearFilters} className="app-btn app-btn--primary">
            Clear Filters
        </button>
    </div>
);

// Loading skeleton
const TenderCardSkeleton: React.FC = () => (
    <div className="tender-card tender-card--skeleton">
        <div className="skeleton skeleton--badge" />
        <div className="skeleton skeleton--badge skeleton--badge-sm" />
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--text" />
        <div className="skeleton skeleton--text skeleton--text-short" />
        <div className="skeleton skeleton--button" />
    </div>
);

const TenderListings: React.FC = () => {
    const router = useRouter();
    const { isAuthenticated, isReady, hasSessionAttempted } = useAuth();

    // Data states
    const [tenders, setTenders] = useState<TenderSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [selectedTender, setSelectedTender] = useState<TenderDetails | null>(null);
    const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [modalView, setModalView] = useState<'details' | 'bid' | 'login'>('details');

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<ProcurementCategory | 'All'>('All');
    const [selectedStatus, setSelectedStatus] = useState<TenderStatus | 'All'>('All');
    const [sortBy, setSortBy] = useState<'deadline' | 'newest' | 'title'>('deadline');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 9;

    // Fetch tenders
    useEffect(() => {
        const fetchTenders = async () => {
            try {
                const tenderData = await getOpenTenders();
                if (Array.isArray(tenderData)) {
                    setTenders(tenderData);
                } else {
                    console.warn("getOpenTenders did not return an array:", tenderData);
                    setTenders([]);
                }
            } catch (err: any) {
                setError(err.message || "An unexpected error occurred");
            } finally {
                setLoading(false);
            }
        };

        fetchTenders();
    }, []);

    // Filter and sort tenders
    const filteredTenders = useMemo(() => {
        let result = [...tenders];

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(tender =>
                tender.Title.toLowerCase().includes(query) ||
                tender.Id.toLowerCase().includes(query)
            );
        }

        // Category filter
        if (selectedCategory !== 'All') {
            result = result.filter(tender => tender.ProcurementCategory === selectedCategory);
        }

        // Status filter
        if (selectedStatus !== 'All') {
            result = result.filter(tender => tender.Status === selectedStatus);
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'deadline':
                    return new Date(a.SubmissionDeadline).getTime() - new Date(b.SubmissionDeadline).getTime();
                case 'newest':
                    return new Date(b.SubmissionDeadline).getTime() - new Date(a.SubmissionDeadline).getTime();
                case 'title':
                    return a.Title.localeCompare(b.Title);
                default:
                    return 0;
            }
        });

        return result;
    }, [tenders, searchQuery, selectedCategory, selectedStatus, sortBy]);

    // Paginated tenders
    const paginatedTenders = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredTenders.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredTenders, currentPage]);

    const totalPages = Math.ceil(filteredTenders.length / ITEMS_PER_PAGE);

    // Clear all filters
    const clearFilters = useCallback(() => {
        setSearchQuery('');
        setSelectedCategory('All');
        setSelectedStatus('All');
        setSortBy('deadline');
        setCurrentPage(1);
    }, []);

    // Modal handlers
    const openTenderDetails = async (tenderId: string) => {
        setDetailsError(null);
        setDetailsLoading(true);
        setModalView('details');
        try {
            const details = await getTenderDetails(tenderId);
            setSelectedTender(details);
        } catch (err: any) {
            setDetailsError(err.message || 'Unable to load tender details.');
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeTenderDetails = () => {
        setSelectedTender(null);
        setDetailsError(null);
        setDetailsLoading(false);
        setModalView('details');
    };

    const handleBid = (tenderId: string) => {
        if (!isReady || !hasSessionAttempted) return;
        if (!isAuthenticated) {
            setModalView('login');
            return;
        }
        setModalView('bid');
    };

    const handleBackToDetails = () => {
        setModalView('details');
    };

    // Stats
    const stats = useMemo(() => ({
        total: tenders.length,
        open: tenders.filter(t => t.Status === 'Open').length,
        closingSoon: tenders.filter(t => {
            const daysLeft = Math.ceil((new Date(t.SubmissionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return daysLeft <= 7 && daysLeft > 0 && t.Status === 'Open';
        }).length
    }), [tenders]);

    if (loading) {
        return (
            <div className="tender-page">
                <div className="tender-page__header">
                    <div className="skeleton skeleton--title" style={{ width: '300px', height: '40px' }} />
                    <div className="skeleton skeleton--text" style={{ width: '400px', marginTop: '8px' }} />
                </div>
                <div className={`tender-grid tender-grid--${viewMode}`}>
                    {[...Array(6)].map((_, i) => (
                        <TenderCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="tender-page">
                <div className="tender-error">
                    <AlertCircle className="tender-error__icon" />
                    <h3 className="tender-error__title">Failed to load tenders</h3>
                    <p className="tender-error__message">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="app-btn app-btn--primary"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="tender-page">
            {/* Header Section */}
            <div className="tender-page__header">
                <div className="tender-page__header-content">
                    <div>
                        <p className="tender-page__subtitle">Procurement Opportunities</p>
                        <h1 className="tender-page__title">Open Tenders</h1>
                        <p className="tender-page__description">
                            Browse active tenders and submit your bids. Stay updated on new opportunities.
                        </p>
                    </div>
                    <div className="tender-stats">
                        <div className="tender-stats__item">
                            <span className="tender-stats__value">{stats.total}</span>
                            <span className="tender-stats__label">Total Tenders</span>
                        </div>
                        <div className="tender-stats__item tender-stats__item--highlight">
                            <span className="tender-stats__value">{stats.open}</span>
                            <span className="tender-stats__label">Open Now</span>
                        </div>
                        <div className="tender-stats__item tender-stats__item--urgent">
                            <span className="tender-stats__value">{stats.closingSoon}</span>
                            <span className="tender-stats__label">Closing Soon</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Section */}
            <div className="tender-filters">
                <div className="tender-filters__search">
                    <Search className="tender-filters__search-icon" />
                    <input
                        type="text"
                        placeholder="Search tenders by title or ID..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="tender-filters__search-input"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="tender-filters__clear"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="tender-filters__controls">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`tender-filters__toggle ${showFilters ? 'tender-filters__toggle--active' : ''}`}
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                        {(selectedCategory !== 'All' || selectedStatus !== 'All') && (
                            <span className="tender-filters__badge" />
                        )}
                    </button>

                    <div className="tender-filters__sort">
                        <span className="tender-filters__sort-label">Sort by:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="tender-filters__sort-select"
                        >
                            <option value="deadline">Deadline (Nearest)</option>
                            <option value="newest">Newest First</option>
                            <option value="title">Title (A-Z)</option>
                        </select>
                    </div>

                    <div className="tender-filters__view">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`tender-filters__view-btn ${viewMode === 'grid' ? 'tender-filters__view-btn--active' : ''}`}
                            title="Grid view"
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`tender-filters__view-btn ${viewMode === 'list' ? 'tender-filters__view-btn--active' : ''}`}
                            title="List view"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
                <div className="tender-filters__expanded">
                    <div className="tender-filters__group">
                        <label className="tender-filters__label">Category</label>
                        <div className="tender-filters__options">
                            {['All', 'Goods', 'Works', 'Services'].map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        setSelectedCategory(cat as any);
                                        setCurrentPage(1);
                                    }}
                                    className={`tender-filters__option ${selectedCategory === cat ? 'tender-filters__option--active' : ''}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="tender-filters__group">
                        <label className="tender-filters__label">Status</label>
                        <div className="tender-filters__options">
                            {['All', 'Open', 'Closed', 'Under Evaluation', 'Awarded'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => {
                                        setSelectedStatus(status as any);
                                        setCurrentPage(1);
                                    }}
                                    className={`tender-filters__option ${selectedStatus === status ? 'tender-filters__option--active' : ''}`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Results Count */}
            <div className="tender-results">
                <span className="tender-results__count">
                    Showing {paginatedTenders.length} of {filteredTenders.length} tenders
                </span>
                {(selectedCategory !== 'All' || selectedStatus !== 'All' || searchQuery) && (
                    <button onClick={clearFilters} className="tender-results__clear">
                        Clear all filters
                    </button>
                )}
            </div>

            {/* Tender Grid/List */}
            {filteredTenders.length === 0 ? (
                <EmptyState onClearFilters={clearFilters} />
            ) : (
                <>
                    <div className={`tender-grid tender-grid--${viewMode}`}>
                        {paginatedTenders.map((tender) => (
                            <article
                                key={tender.Id}
                                className={`tender-card ${tender.Status === 'Open' ? 'tender-card--active' : 'tender-card--inactive'}`}
                            >
                                <div className="tender-card__header">
                                    <div className="tender-card__badges">
                                        <StatusBadge status={tender.Status} />
                                        <CategoryBadge category={tender.ProcurementCategory} />
                                    </div>
                                    <CountdownBadge deadline={tender.SubmissionDeadline} />
                                </div>

                                <h3 className="tender-card__title">{tender.Title}</h3>

                                <div className="tender-card__meta">
                                    <div className="tender-card__meta-item">
                                        <Calendar className="tender-card__meta-icon" />
                                        <span>
                                            Deadline: {new Date(tender.SubmissionDeadline).toLocaleDateString('en-NG', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                    <div className="tender-card__meta-item">
                                        <FileText className="tender-card__meta-icon" />
                                        <span>Tender ID: {tender.Id.slice(0, 8)}...</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => openTenderDetails(tender.Id)}
                                    className="tender-card__action"
                                    disabled={tender.Status !== 'Open'}
                                >
                                    {tender.Status === 'Open' ? (
                                        <>
                                            View Details
                                            <ArrowRight className="tender-card__action-icon" />
                                        </>
                                    ) : (
                                        'View Only'
                                    )}
                                </button>
                            </article>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="tender-pagination">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="tender-pagination__btn"
                            >
                                Previous
                            </button>
                            <div className="tender-pagination__pages">
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`tender-pagination__page ${currentPage === i + 1 ? 'tender-pagination__page--active' : ''}`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="tender-pagination__btn"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Modal */}
            {(detailsLoading || detailsError || selectedTender) && (
                <div className="tender-modal__overlay" onClick={closeTenderDetails}>
                    <div
                        className="tender-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={closeTenderDetails}
                            className="tender-modal__close"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {detailsLoading && (
                            <div className="tender-modal__loading">
                                <div className="tender-modal__spinner" />
                                <p>Loading tender details...</p>
                            </div>
                        )}

                        {detailsError && !detailsLoading && (
                            <div className="tender-modal__error">
                                <AlertCircle className="w-12 h-12 text-red-500" />
                                <p>{detailsError}</p>
                                <button
                                    onClick={closeTenderDetails}
                                    className="app-btn app-btn--primary"
                                >
                                    Close
                                </button>
                            </div>
                        )}

                        {selectedTender && !detailsLoading && !detailsError && modalView === 'details' && (
                            <TenderDetailsComponent
                                tender={selectedTender}
                                onClose={closeTenderDetails}
                                onBid={() => handleBid(selectedTender.Id)}
                            />
                        )}

                        {selectedTender && !detailsLoading && !detailsError && modalView === 'bid' && (
                            <BidSubmissionForm
                                tenderId={selectedTender.Id}
                                onBack={handleBackToDetails}
                                onClose={closeTenderDetails}
                            />
                        )}

                        {selectedTender && !detailsLoading && !detailsError && modalView === 'login' && (
                            <div className="tender-modal__login">
                                <div className="tender-modal__login-icon">
                                    <AlertCircle className="w-16 h-16 text-amber-500" />
                                </div>
                                <h3 className="tender-modal__login-title">Login Required</h3>
                                <p className="tender-modal__login-text">
                                    You need an active vendor session to submit bids.
                                </p>
                                <div className="tender-modal__login-actions">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.push(`/vendors/login?next=${encodeURIComponent(`/vendors/bid-submission/${selectedTender.Id}`)}`)
                                        }
                                        className="app-btn app-btn--primary app-btn--lg"
                                    >
                                        Go to Login
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeTenderDetails}
                                        className="app-btn app-btn--secondary"
                                    >
                                        Stay Here
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenderListings;
