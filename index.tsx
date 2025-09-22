import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  RefreshControl,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';

const EXPO_PUBLIC_BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

type Priority = 'low' | 'medium' | 'high' | 'urgent';
type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';

interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  status: TaskStatus;
  priority: Priority;
  due_date?: string;
  tags: string[];
  category: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface TaskStats {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  by_priority: { [key: string]: number };
  by_category: { [key: string]: number };
  by_status: { [key: string]: number };
}

const STORAGE_KEY = '@tasks';

const PRIORITY_COLORS = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#FF5722',
  urgent: '#F44336',
};

const PRIORITY_ICONS = {
  low: 'flag-outline',
  medium: 'flag',
  high: 'flag',
  urgent: 'warning',
};

const CATEGORIES = [
  { value: 'general', label: 'General', icon: 'folder-outline' },
  { value: 'work', label: 'Work', icon: 'briefcase-outline' },
  { value: 'personal', label: 'Personal', icon: 'person-outline' },
  { value: 'shopping', label: 'Shopping', icon: 'cart-outline' },
  { value: 'health', label: 'Health', icon: 'heart-outline' },
  { value: 'finance', label: 'Finance', icon: 'card-outline' },
  { value: 'education', label: 'Education', icon: 'school-outline' },
  { value: 'travel', label: 'Travel', icon: 'airplane-outline' },
];

export default function TodoApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [isOffline, setIsOffline] = useState(false);
  
  // Add task modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('general');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Stats state
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Load tasks on app start
  useEffect(() => {
    loadTasks();
    loadStats();
  }, []);

  // API Functions
  const apiCall = async (url: string, options: RequestInit = {}) => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      setIsOffline(true);
      throw error;
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (selectedPriority !== 'all') params.append('priority', selectedPriority);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      if (filter === 'completed') params.append('completed', 'true');
      if (filter === 'pending') params.append('completed', 'false');
      
      const queryString = params.toString();
      const url = `/tasks${queryString ? '?' + queryString : ''}`;
      
      const apiTasks = await apiCall(url);
      setTasks(apiTasks);
      setIsOffline(false);
      
      // Save to AsyncStorage for offline access
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(apiTasks));
    } catch (error) {
      // If API fails, load from AsyncStorage
      try {
        const savedTasks = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedTasks) {
          setTasks(JSON.parse(savedTasks));
        }
        setIsOffline(true);
      } catch (storageError) {
        console.error('Failed to load tasks from storage:', storageError);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await apiCall('/tasks/stats');
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const addTask = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    const newTaskData = {
      title: inputText.trim(),
      description: description.trim(),
      priority,
      category,
      tags: tags.filter(tag => tag.length > 0),
      due_date: dueDate?.toISOString(),
    };

    try {
      // Add to API if online
      if (!isOffline) {
        const createdTask = await apiCall('/tasks', {
          method: 'POST',
          body: JSON.stringify(newTaskData),
        });
        
        // Reload tasks and stats
        await loadTasks();
        await loadStats();
      } else {
        // Offline mode - add to local storage
        const offlineTask: Task = {
          id: Date.now().toString(),
          ...newTaskData,
          completed: false,
          status: 'todo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        const updatedTasks = [offlineTask, ...tasks];
        setTasks(updatedTasks);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
      }

      // Reset form
      setInputText('');
      setDescription('');
      setPriority('medium');
      setCategory('general');
      setTags([]);
      setDueDate(null);
      setShowAddModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add task');
    }
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      // Update via API if online
      if (!isOffline) {
        await apiCall(`/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ completed: !task.completed }),
        });
        
        // Reload tasks and stats
        await loadTasks();
        await loadStats();
      } else {
        // Offline mode
        const updatedTasks = tasks.map(t =>
          t.id === taskId
            ? { ...t, completed: !t.completed, updated_at: new Date().toISOString() }
            : t
        );
        setTasks(updatedTasks);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const deleteTask = (taskId: string) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(taskId) },
      ]
    );
  };

  const confirmDelete = async (taskId: string) => {
    try {
      // Delete from API if online
      if (!isOffline) {
        await apiCall(`/tasks/${taskId}`, { method: 'DELETE' });
        
        // Reload tasks and stats
        await loadTasks();
        await loadStats();
      } else {
        // Offline mode
        const updatedTasks = tasks.filter(t => t.id !== taskId);
        setTasks(updatedTasks);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete task');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    await loadStats();
    setRefreshing(false);
  };

  const addTag = () => {
    if (tagInput.trim() && tags.length < 10 && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1) return `In ${diffDays} days`;
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
    
    return date.toLocaleDateString();
  };

  const isOverdue = (dateString: string) => {
    return new Date(dateString) < new Date() && !tasks.find(t => t.due_date === dateString)?.completed;
  };

  // Filter and search tasks
  const filteredTasks = tasks.filter(task => {
    // Text search
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        task.category.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    // Priority filter
    if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false;
    
    // Category filter
    if (selectedCategory !== 'all' && task.category !== selectedCategory) return false;
    
    // Status filter
    if (filter === 'completed') return task.completed;
    if (filter === 'pending') return !task.completed;
    
    return true;
  });

  const getTaskCounts = () => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.completed).length;
    const pending = total - completed;
    return { total, completed, pending };
  };

  const renderTask = ({ item, index }: { item: Task; index: number }) => {
    const priorityColor = PRIORITY_COLORS[item.priority];
    const isTaskOverdue = item.due_date && isOverdue(item.due_date) && !item.completed;

    return (
      <View
        style={[
          styles.taskItem,
          item.completed && styles.taskCompleted,
          isTaskOverdue && styles.taskOverdue,
        ]}
      >
        <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} />
        
        <TouchableOpacity
          style={styles.taskContent}
          onPress={() => toggleTask(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.taskLeft}>
            <Ionicons
              name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={item.completed ? '#4CAF50' : '#9E9E9E'}
            />
            <View style={styles.taskText}>
              <View style={styles.taskHeader}>
                <Text style={[styles.taskTitle, item.completed && styles.completedText]}>
                  {item.title}
                </Text>
                <View style={styles.taskMeta}>
                  <Ionicons 
                    name={PRIORITY_ICONS[item.priority]} 
                    size={12} 
                    color={priorityColor} 
                  />
                  <Text style={[styles.priorityText, { color: priorityColor }]}>
                    {item.priority.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              {item.description ? (
                <Text style={[styles.taskDescription, item.completed && styles.completedText]}>
                  {item.description}
                </Text>
              ) : null}
              
              <View style={styles.taskFooter}>
                <View style={styles.categoryContainer}>
                  <Ionicons 
                    name={CATEGORIES.find(c => c.value === item.category)?.icon || 'folder-outline'} 
                    size={12} 
                    color="#757575" 
                  />
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
                
                {item.due_date && (
                  <View style={[styles.dueDateContainer, isTaskOverdue && styles.overdueDateContainer]}>
                    <Ionicons 
                      name="time-outline" 
                      size={12} 
                      color={isTaskOverdue ? '#F44336' : '#757575'} 
                    />
                    <Text style={[styles.dueDateText, isTaskOverdue && styles.overdueDateText]}>
                      {formatDate(item.due_date)}
                    </Text>
                  </View>
                )}
              </View>
              
              {item.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {item.tags.slice(0, 3).map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                  {item.tags.length > 3 && (
                    <Text style={styles.moreTagsText}>+{item.tags.length - 3}</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteTask(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
    );
  };

  const FilterButton = ({ filterType, label, count }: { filterType: typeof filter; label: string; count: number }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === filterType && styles.activeFilter]}
      onPress={() => setFilter(filterType)}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterText, filter === filterType && styles.activeFilterText]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );

  const counts = getTaskCounts();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>My Tasks</Text>
            {isOffline && (
              <View style={styles.offlineIndicator}>
                <Ionicons name="cloud-offline" size={16} color="#FF9800" />
                <Text style={styles.offlineText}>Offline Mode</Text>
              </View>
            )}
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowStats(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="stats-chart" size={24} color="#2196F3" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowFilters(!showFilters)}
              activeOpacity={0.7}
            >
              <Ionicons name="filter" size={24} color="#2196F3" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#757575" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks..."
            placeholderTextColor="#9E9E9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => loadTasks()}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); loadTasks(); }}>
              <Ionicons name="close" size={20} color="#757575" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        {showFilters && (
          <View style={styles.filtersContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Priority:</Text>
                {['all', 'low', 'medium', 'high', 'urgent'].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.filterChip,
                      selectedPriority === p && styles.activeFilterChip,
                      p !== 'all' && { borderColor: PRIORITY_COLORS[p as Priority] }
                    ]}
                    onPress={() => {
                      setSelectedPriority(p as Priority | 'all');
                      loadTasks();
                    }}
                  >
                    <Text style={[
                      styles.filterChipText,
                      selectedPriority === p && styles.activeFilterChipText
                    ]}>
                      {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Category:</Text>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedCategory === 'all' && styles.activeFilterChip
                  ]}
                  onPress={() => {
                    setSelectedCategory('all');
                    loadTasks();
                  }}
                >
                  <Text style={[
                    styles.filterChipText,
                    selectedCategory === 'all' && styles.activeFilterChipText
                  ]}>
                    All
                  </Text>
                </TouchableOpacity>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.filterChip,
                      selectedCategory === cat.value && styles.activeFilterChip
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat.value);
                      loadTasks();
                    }}
                  >
                    <Ionicons name={cat.icon as any} size={12} color="#757575" />
                    <Text style={[
                      styles.filterChipText,
                      selectedCategory === cat.value && styles.activeFilterChipText
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <FilterButton filterType="all" label="All" count={counts.total} />
          <FilterButton filterType="pending" label="Pending" count={counts.pending} />
          <FilterButton filterType="completed" label="Completed" count={counts.completed} />
        </View>

        {/* Task List */}
        <FlatList
          data={filteredTasks}
          renderItem={renderTask}
          keyExtractor={item => item.id}
          style={styles.taskList}
          contentContainerStyle={filteredTasks.length === 0 ? styles.emptyContainer : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2196F3']}
              tintColor="#2196F3"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={80} color="#E0E0E0" />
              <Text style={styles.emptyText}>
                {filter === 'completed' ? 'No completed tasks' : 
                 filter === 'pending' ? 'No pending tasks' : 
                 'No tasks yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all' ? 'Add your first task below!' : ''}
              </Text>
            </View>
          }
        />

        {/* Floating Add Button */}
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Add Task Modal */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Task</Text>
              <TouchableOpacity onPress={addTask}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Title *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter task title"
                  value={inputText}
                  onChangeText={setInputText}
                  maxLength={200}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.modalInput, styles.descriptionInput]}
                  placeholder="Add description (optional)"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  maxLength={1000}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Priority</Text>
                <View style={styles.priorityButtons}>
                  {(['low', 'medium', 'high', 'urgent'] as Priority[]).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityButton,
                        priority === p && { backgroundColor: PRIORITY_COLORS[p] }
                      ]}
                      onPress={() => setPriority(p)}
                    >
                      <Ionicons 
                        name={PRIORITY_ICONS[p]} 
                        size={16} 
                        color={priority === p ? '#FFFFFF' : PRIORITY_COLORS[p]} 
                      />
                      <Text style={[
                        styles.priorityButtonText,
                        priority === p && { color: '#FFFFFF' }
                      ]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.categoryButtons}>
                    {CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat.value}
                        style={[
                          styles.categoryButton,
                          category === cat.value && styles.activeCategoryButton
                        ]}
                        onPress={() => setCategory(cat.value)}
                      >
                        <Ionicons 
                          name={cat.icon as any} 
                          size={16} 
                          color={category === cat.value ? '#2196F3' : '#757575'} 
                        />
                        <Text style={[
                          styles.categoryButtonText,
                          category === cat.value && { color: '#2196F3' }
                        ]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Due Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#757575" />
                  <Text style={styles.dateButtonText}>
                    {dueDate ? dueDate.toLocaleDateString() : 'Set due date'}
                  </Text>
                  {dueDate && (
                    <TouchableOpacity onPress={() => setDueDate(null)}>
                      <Ionicons name="close" size={16} color="#757575" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Tags (max 10)</Text>
                <View style={styles.tagInputContainer}>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="Add tag..."
                    value={tagInput}
                    onChangeText={setTagInput}
                    onSubmitEditing={addTag}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
                    <Ionicons name="add" size={16} color="#2196F3" />
                  </TouchableOpacity>
                </View>
                
                {tags.length > 0 && (
                  <View style={styles.tagsPreview}>
                    {tags.map((tag, index) => (
                      <View key={index} style={styles.tagPreview}>
                        <Text style={styles.tagPreviewText}>#{tag}</Text>
                        <TouchableOpacity onPress={() => removeTag(tag)}>
                          <Ionicons name="close" size={14} color="#757575" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>

          {showDatePicker && (
            <DateTimePicker
              value={dueDate || new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setDueDate(selectedDate);
                }
              }}
              minimumDate={new Date()}
            />
          )}
        </Modal>

        {/* Stats Modal */}
        <Modal
          visible={showStats}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowStats(false)}>
                <Text style={styles.cancelButton}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Task Statistics</Text>
              <View />
            </View>

            {stats && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{stats.total_tasks}</Text>
                    <Text style={styles.statLabel}>Total Tasks</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.completed_tasks}</Text>
                    <Text style={styles.statLabel}>Completed</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: '#FF9800' }]}>{stats.pending_tasks}</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: '#F44336' }]}>{stats.overdue_tasks}</Text>
                    <Text style={styles.statLabel}>Overdue</Text>
                  </View>
                </View>

                <View style={styles.statsSection}>
                  <Text style={styles.sectionTitle}>By Priority</Text>
                  {Object.entries(stats.by_priority).map(([priority, count]) => (
                    <View key={priority} style={styles.statRow}>
                      <View style={styles.statRowLeft}>
                        <View style={[
                          styles.priorityIndicatorSmall, 
                          { backgroundColor: PRIORITY_COLORS[priority as Priority] }
                        ]} />
                        <Text style={styles.statRowLabel}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</Text>
                      </View>
                      <Text style={styles.statRowValue}>{count}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.statsSection}>
                  <Text style={styles.sectionTitle}>By Category</Text>
                  {Object.entries(stats.by_category).map(([category, count]) => (
                    <View key={category} style={styles.statRow}>
                      <View style={styles.statRowLeft}>
                        <Ionicons 
                          name={CATEGORIES.find(c => c.value === category)?.icon || 'folder-outline'} 
                          size={16} 
                          color="#757575" 
                        />
                        <Text style={styles.statRowLabel}>{category.charAt(0).toUpperCase() + category.slice(1)}</Text>
                      </View>
                      <Text style={styles.statRowValue}>{count}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 8,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  offlineText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#212121',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginRight: 12,
    minWidth: 60,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activeFilterChip: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 4,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  activeFilter: {
    backgroundColor: '#2196F3',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#757575',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  taskList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9E9E9E',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BDBDBD',
    marginTop: 8,
  },
  taskItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginVertical: 6,
    paddingLeft: 4,
    paddingRight: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  taskCompleted: {
    backgroundColor: '#F8F9FA',
  },
  taskOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  priorityIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskText: {
    marginLeft: 12,
    flex: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    lineHeight: 22,
    flex: 1,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  taskDescription: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
    lineHeight: 18,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#9E9E9E',
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overdueDateContainer: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dueDateText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  overdueDateText: {
    color: '#F44336',
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 10,
    color: '#757575',
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFEBEE',
    marginLeft: 12,
  },
  floatingButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
  cancelButton: {
    fontSize: 16,
    color: '#757575',
  },
  saveButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  formGroup: {
    marginVertical: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    color: '#212121',
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    color: '#212121',
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activeCategoryButton: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#212121',
    marginLeft: 8,
    flex: 1,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
    marginRight: 8,
  },
  addTagButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tagPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagPreviewText: {
    fontSize: 12,
    color: '#1976D2',
    marginRight: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212121',
  },
  statLabel: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  statsSection: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityIndicatorSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statRowLabel: {
    fontSize: 16,
    color: '#212121',
    marginLeft: 4,
  },
  statRowValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
});