"use client";

import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { ToastProvider, useToast } from "./toast";
import { EmptyState } from "./empty-state";
import { Skeleton, SkeletonCard, SkeletonText } from "./skeleton";
import { LoadingSpinner, LoadingOverlay, ProgressBar } from "./loading-spinner";
import { Badge, StatusDot, Pill } from "./badge";
import { Tooltip, InfoTooltip } from "./tooltip";
import { Modal, ConfirmationModal, AlertModal } from "./modal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, StatCard } from "./card";
import { Divider, SectionHeader, FeatureCard, StepIndicator, ProgressStep, EmptyResults, ErrorBoundary, LoadingState } from "./ui-utils";

export function UIShowcase() {
  const [showModal, setShowModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(50);

  const toast = useToast();

  const handleButtonClick = () => {
    toast.toast("Button clicked!", { type: "success" });
  };

  const handleLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const handleProgress = () => {
    setProgress(prev => (prev >= 100 ? 0 : prev + 10));
  };

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 space-y-10">
        <SectionHeader
          title="Premium UI/UX Showcase"
          subtitle="Demonstrating refined components with enhanced visual hierarchy and interactions"
        />

      {/* Buttons Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Enhanced Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={handleButtonClick}>Primary Button</Button>
          <Button variant="secondary" onClick={handleButtonClick}>Secondary Button</Button>
          <Button variant="success" onClick={handleButtonClick}>Success Button</Button>
          <Button variant="danger" onClick={handleButtonClick}>Danger Button</Button>
          <Button variant="outline" onClick={handleButtonClick}>Outline Button</Button>
          <Button variant="ghost" onClick={handleButtonClick}>Ghost Button</Button>
          <Button variant="primary" size="lg" onClick={handleButtonClick}>Large Button</Button>
          <Button variant="primary" size="sm" onClick={handleButtonClick}>Small Button</Button>
          <Button variant="primary" loading onClick={handleButtonClick}>Loading Button</Button>
          <Button variant="primary" disabled onClick={handleButtonClick}>Disabled Button</Button>
        </div>
      </div>

      {/* Inputs Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Enhanced Inputs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Name" placeholder="Enter your name" />
          <Input label="Email" type="email" placeholder="Enter your email" />
          <Input label="Password" type="password" placeholder="Enter password" />
          <Input label="Error Input" error="This field is required" placeholder="Error state" />
          <Input label="With Icon" leftIcon="🔍" placeholder="Search..." />
          <Input label="With Hint" hint="Enter at least 8 characters" placeholder="Password" />
        </div>
      </div>

      {/* Badges & Status Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Badges & Status Indicators</h3>
        <div className="flex flex-wrap gap-3">
          <Badge variant="primary">Primary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="primary" size="lg">Large Badge</Badge>
          <Badge variant="primary" size="sm">Small Badge</Badge>
          <Pill>Pill Badge</Pill>
          <StatusDot status="active" />
          <StatusDot status="pending" />
          <StatusDot status="success" />
          <StatusDot status="error" />
        </div>
      </div>

      {/* Cards Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Enhanced Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card hoverEffect>
            <CardHeader>
              <CardTitle>Basic Card</CardTitle>
              <CardDescription>With hover effects and better visual hierarchy</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300">Enhanced card with improved spacing and hover states.</p>
            </CardContent>
            <CardFooter>
              <Button variant="primary" size="sm">Action</Button>
            </CardFooter>
          </Card>

          <StatCard
            title="Total Users"
            value="1,248"
            icon="👤"
            trend="up"
            trendValue="12%"
          />

          <StatCard
            title="Revenue"
            value="$48,250"
            icon="💰"
            trend="down"
            trendValue="5%"
          />
        </div>
      </div>

      {/* Loading States Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Loading States</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <LoadingSpinner size="sm" />
            <LoadingSpinner size="md" />
            <LoadingSpinner size="lg" />
            <LoadingSpinner size="xl" />
            <ProgressBar value={progress} />
            <Button onClick={handleProgress}>Increase Progress</Button>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-32" />
            <SkeletonText lines={3} />
            <SkeletonCard />
            <Skeleton className="h-12 w-48 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Tooltips Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Tooltips</h3>
        <div className="flex flex-wrap gap-4">
          <Tooltip content="This is a tooltip on top" position="top">
            <Button variant="secondary">Hover for Top Tooltip</Button>
          </Tooltip>
          <Tooltip content="This is a tooltip on bottom" position="bottom">
            <Button variant="secondary">Hover for Bottom Tooltip</Button>
          </Tooltip>
          <Tooltip content="This is a tooltip on left" position="left">
            <Button variant="secondary">Hover for Left Tooltip</Button>
          </Tooltip>
          <Tooltip content="This is a tooltip on right" position="right">
            <Button variant="secondary">Hover for Right Tooltip</Button>
          </Tooltip>
          <InfoTooltip content="This provides additional information about the feature" />
        </div>
      </div>

      {/* Empty States Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Empty States</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EmptyState
            title="No Results Found"
            description="Try adjusting your search or filters to find what you're looking for."
            action={{
              label: "Reset Filters",
              onClick: () => toast.toast("Filters reset!", { type: "info" })
            }}
          />
          <EmptyResults
            title="No Data Available"
            description="There's no data to display for this view."
            icon="📊"
          />
        </div>
      </div>

      {/* Modal Triggers */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Modals & Dialogs</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => setShowModal(true)}>Open Modal</Button>
          <Button variant="secondary" onClick={() => setShowConfirmation(true)}>Open Confirmation</Button>
          <Button variant="danger" onClick={() => setShowAlert(true)}>Open Alert</Button>
        </div>
      </div>

      {/* Step Indicators Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Step Indicators</h3>
        <StepIndicator
          steps={["Setup", "Configuration", "Review", "Complete"]}
          currentStep={2}
        />
        <ProgressStep
          step={3}
          totalSteps={5}
          title="Review Configuration"
          description="Check your settings before finalizing"
        />
      </div>

      {/* Feature Cards Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Feature Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon="⚡"
            title="Fast Performance"
            description="Optimized for speed and efficiency with minimal overhead."
          />
          <FeatureCard
            icon="🔒"
            title="Secure"
            description="Enterprise-grade security with end-to-end encryption."
          />
          <FeatureCard
            icon="🌐"
            title="Global Reach"
            description="Available worldwide with multi-region support."
          />
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && <LoadingOverlay message="Processing your request..." />}

      {/* Modals */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Enhanced Modal"
        description="This modal has improved animations and accessibility."
      >
        <div className="space-y-4">
          <p className="text-slate-300">Experience the enhanced modal with smooth animations, better focus management, and improved accessibility.</p>
          <Input label="Example Input" placeholder="Type something..." />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              toast.toast("Action completed!", { type: "success" });
              setShowModal(false);
            }}>Confirm</Button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={() => toast.toast("Action confirmed!", { type: "success" })}
        title="Confirm Action"
        message="Are you sure you want to perform this action? This cannot be undone."
        confirmText="Yes, Continue"
        cancelText="No, Cancel"
        confirmVariant="danger"
      />

      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title="Success!"
        message="Your action was completed successfully."
        type="success"
      />
    </div>
  );
}

export function UIShowcasePage() {
  return (
    <ToastProvider>
      <UIShowcase />
    </ToastProvider>
  );
}