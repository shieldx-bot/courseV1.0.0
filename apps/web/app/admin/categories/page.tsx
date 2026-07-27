"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import { Plus, Trash2, Edit, Save, X, BookOpen } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  course_count: number;
}

interface CategoryIn {
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  course_count?: number;
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CategoryIn>({ name: "", slug: "", icon: "book", description: "", course_count: 0 });
  const [editForm, setEditForm] = useState<CategoryIn>({ name: "", slug: "", icon: "book", description: "", course_count: 0 });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await apiFetch<Category[]>("/admin/categories");
      setCategories(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setError("Name and slug are required");
      return;
    }

    try {
      await apiFetch("/admin/categories", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", slug: "", icon: "book", description: "", course_count: 0 });
      setShowForm(false);
      await loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await apiFetch(`/admin/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });
      setEditingId(null);
      await loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      await apiFetch(`/admin/categories/${id}`, { method: "DELETE" });
      await loadCategories();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditForm({ name: cat.name, slug: cat.slug, icon: cat.icon || "book", description: cat.description || "", course_count: cat.course_count });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", slug: "", icon: "book", description: "", course_count: 0 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-gray-500 mt-1">Manage course categories</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      {/* Create Form */}
      {showForm && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Programming"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug *</label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="e.g., programming"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Icon</label>
              <Input
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="e.g., code, book, brain"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Course Count</label>
              <Input
                type="number"
                value={form.course_count}
                onChange={(e) => setForm({ ...form, course_count: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Category description"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleCreate} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              <X className="w-4 h-4" />
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Categories List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Card key={cat.id} className="p-6">
            {editingId === cat.id ? (
              // Edit Mode
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Slug</label>
                  <Input
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Icon</label>
                  <Input
                    value={editForm.icon}
                    onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Input
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleUpdate(cat.id)} size="sm" className="flex items-center gap-1">
                    <Save className="w-3 h-3" />
                    Save
                  </Button>
                  <Button variant="outline" onClick={cancelEdit} size="sm">
                    <X className="w-3 h-3" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // View Mode
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">{cat.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(cat)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(cat.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><span className="font-medium">ID:</span> {cat.id}</p>
                  <p><span className="font-medium">Slug:</span> {cat.slug}</p>
                  <p><span className="font-medium">Icon:</span> {cat.icon || "book"}</p>
                  {cat.description && <p><span className="font-medium">Description:</span> {cat.description}</p>}
                  <p><span className="font-medium">Courses:</span> {cat.course_count}</p>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {categories.length === 0 && !loading && (
        <Card className="p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No categories yet</h3>
          <p className="text-gray-500 mb-4">Get started by creating your first category</p>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </Card>
      )}
    </div>
  );
}