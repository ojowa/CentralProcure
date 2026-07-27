'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import {
  FileText,
  LogIn,
  UserPlus,
  TrendingUp,
  Shield,
  Clock,
  Bell,
  ChevronRight,
  Building2,
  Award,
  Globe2,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';

const VendorHomePage: React.FC = () => {
  const { isAuthenticated, isReady, hasSessionAttempted } = useAuth();
  const vendorLoginHref = isReady && hasSessionAttempted && isAuthenticated ? '/vendors/dashboard' : '/vendors/login';

  const stats = [
    { label: 'Active Tenders', value: '24', icon: FileText, color: 'from-emerald-500 to-teal-600' },
    { label: 'Registered Vendors', value: '1,247', icon: Building2, color: 'from-blue-500 to-indigo-600' },
    { label: 'Contracts Awarded', value: '89', icon: Award, color: 'from-amber-500 to-orange-600' },
    { label: 'Total Value', value: '₦2.4B', icon: TrendingUp, color: 'from-violet-500 to-purple-600' },
  ];

  const quickActions = [
    {
      title: 'Browse Open Tenders',
      description: 'Explore active procurement opportunities and submit competitive bids.',
      to: '/vendors/tenders',
      icon: FileText,
      gradient: 'from-emerald-500 to-teal-600',
      lightGradient: 'from-emerald-50 to-teal-50',
    },
    {
      title: 'Vendor Dashboard',
      description: 'Access your account, track submissions, and manage documents.',
      to: vendorLoginHref,
      icon: LogIn,
      gradient: 'from-blue-500 to-indigo-600',
      lightGradient: 'from-blue-50 to-indigo-50',
    },
    {
      title: 'Register Organization',
      description: 'Complete vendor registration to participate in public procurement.',
      to: '/vendors/register',
      icon: UserPlus,
      gradient: 'from-amber-500 to-orange-600',
      lightGradient: 'from-amber-50 to-orange-50',
    },
  ];

  const notices = [
    {
      title: 'Mandatory compliance documents update window',
      date: 'Feb 10, 2026',
      type: 'Urgent',
      category: 'Compliance',
    },
    {
      title: 'Clarification addendum published for ICT equipment lots',
      date: 'Feb 7, 2026',
      type: 'Update',
      category: 'ICT',
    },
    {
      title: 'Bid opening timetable for Q1 infrastructure tenders',
      date: 'Feb 3, 2026',
      type: 'Schedule',
      category: 'Infrastructure',
    },
    {
      title: 'New vendor evaluation criteria effective March 1',
      date: 'Jan 28, 2026',
      type: 'Policy',
      category: 'General',
    },
  ];

  const features = [
    {
      icon: Globe2,
      title: 'Transparent Process',
      description: 'Public access to tender notices, award information, and procurement records.',
    },
    {
      icon: Shield,
      title: 'Secure Submissions',
      description: 'Encrypted bid submission with digital signature verification and audit trails.',
    },
    {
      icon: Clock,
      title: 'Real-time Updates',
      description: 'Instant notifications for tender updates, clarifications, and award decisions.',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1] as const,
      },
    },
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'Urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Update':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Schedule':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/backgroundimage.jpeg')" }}
        />
        {/* Dark Overlay for text readability */}
        <div className="absolute inset-0 bg-slate-900/40" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/30 via-emerald-950/20 to-slate-900/30" />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Floating Orbs */}
        <motion.div
          className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-emerald-500/20 blur-[100px]"
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -right-20 bottom-20 h-80 w-80 rounded-full bg-cyan-500/15 blur-[80px]"
          animate={{
            x: [0, -20, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] as const }}
            className="text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 backdrop-blur-sm"
            >
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wider text-emerald-100 uppercase">
                Nigeria Immigration Service
              </span>
              <span className="text-emerald-400/60">|</span>
              <span className="text-xs font-medium text-emerald-200">
                Procurement Portal
              </span>
            </motion.div>

            {/* Main Heading */}
            <h1 className="mx-auto max-w-5xl font-poppins text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              <span className="block">Open, Digital Procurement for NIS</span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              Access tenders, submit bids online, and engage with procurement processes
              across all formations—anytime, anywhere.
            </p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Link
                href="/vendors/tenders"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-105"
              >
                <span>View Open Tenders</span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href="/vendors/register"
                className="group inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800/50 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-slate-700/50 hover:border-slate-500"
              >
                <UserPlus className="h-4 w-4" />
                <span>Register as Vendor</span>
              </Link>
            </motion.div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-16"
          >
            <div className="grid grid-cols-2 gap-4 rounded-2xl bg-white/5 p-2 backdrop-blur-md sm:grid-cols-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
                  className="relative overflow-hidden rounded-xl p-4 text-center sm:p-6"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-10`} />
                  <div className="relative">
                    <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color}`}>
                      <stat.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="font-outfit text-2xl font-bold text-white sm:text-3xl">{stat.value}</div>
                    <div className="mt-1 text-xs font-medium text-slate-400">{stat.label}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Actions Grid */}
      <section className="relative -mt-8 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid gap-6 md:grid-cols-3"
        >
          {quickActions.map((action) => (
            <motion.div key={action.title} variants={itemVariants}>
              <Link
                href={action.to}
                className="group relative block h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Card Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${action.lightGradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

                <div className="relative">
                  <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-1`}>
                    <action.icon className="h-6 w-6 text-white" />
                  </div>

                  <h3 className="font-poppins text-lg font-bold text-slate-900 group-hover:text-slate-800">
                    {action.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {action.description}
                  </p>

                  <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-slate-700 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:gap-2">
                    <span>Get Started</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Main Content Grid */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Notices Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-2"
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-md">
                    <Bell className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-poppins text-lg font-bold text-slate-900">Latest Notices</h3>
                    <p className="text-xs text-slate-500">Stay updated with procurement announcements</p>
                  </div>
                </div>
                <Link
                  href="/vendors/tenders"
                  className="group flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-emerald-50 hover:text-emerald-800 hover:ring-emerald-300"
                >
                  View All
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Notices List */}
              <div className="divide-y divide-slate-100">
                {notices.map((notice, index) => (
                  <motion.div
                    key={notice.title}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    className="group flex items-start gap-4 p-4 transition-colors hover:bg-slate-50 sm:items-center sm:p-5"
                  >
                    {/* Date Badge */}
                    <div className="flex-shrink-0 text-center">
                      <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs">
                        <div className="font-bold text-slate-900">
                          {new Date(notice.date).toLocaleDateString('en-US', { day: 'numeric' })}
                        </div>
                        <div className="text-slate-500 uppercase">
                          {new Date(notice.date).toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getBadgeColor(notice.type)}`}>
                          {notice.type}
                        </span>
                        <span className="text-xs text-slate-500">{notice.category}</span>
                      </div>
                      <h4 className="mt-1 text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2">
                        {notice.title}
                      </h4>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300 transition-all group-hover:text-emerald-500 group-hover:translate-x-1" />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Side Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Service Highlights */}
            <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-6">
              <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Service Highlights
              </h3>
              <div className="mt-4 space-y-3">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
                    className="group flex items-start gap-3 rounded-xl bg-white/70 p-3 backdrop-blur-sm transition-all hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                      <feature.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{feature.title}</h4>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {feature.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <Link
                href={vendorLoginHref}
                className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-700/25 transition-all hover:bg-emerald-800 hover:shadow-emerald-700/40 hover:scale-[1.02]"
              >
                <LogIn className="h-4 w-4" />
                Access Vendor Portal
              </Link>
            </div>

            {/* Contact Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Need Assistance?
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Contact the procurement support team for help with registration or submissions.
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>procurement@nis.gov.ng</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>+234 123 456 7890</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 sm:flex-row sm:p-10"
          >
            <div>
              <h2 className="font-poppins text-xl font-bold text-white sm:text-2xl">
                Ready to start bidding?
              </h2>
              <p className="mt-2 text-slate-400">
                Join hundreds of registered vendors competing for public contracts.
              </p>
            </div>
            <Link
              href="/vendors/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-emerald-50 hover:scale-105"
            >
              Register Now
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default VendorHomePage;
