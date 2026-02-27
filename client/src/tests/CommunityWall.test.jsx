import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommunityWall from '../components/CommunityWall';
import axios from 'axios';

vi.mock('axios', () => {
    const mockAxios = {
        create: vi.fn(() => mockAxios),
        interceptors: {
            request: { use: vi.fn(), eject: vi.fn() },
            response: { use: vi.fn(), eject: vi.fn() },
        },
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        defaults: { headers: { common: {} } }
    };
    return { default: mockAxios };
});

describe('CommunityWall - Intensive Testing', () => {
    const mockUser = { _id: 'u1', username: 'test', firstName: 'Test', role: 'USER', permissions: [{ key: 'HOME', canView: true, canEdit: true }] };
    const mockPosts = [
        { 
            _id: 'p1', 
            content: 'Hello World', 
            author: { _id: 'u1', username: 'test', firstName: 'Test' }, 
            createdAt: new Date().toISOString(),
            likes: [],
            comments: []
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockImplementation((url) => {
            if (url.startsWith('/api/channels')) return Promise.resolve({ data: [] });
            if (url.startsWith('/api/wall/p1/comments')) return Promise.resolve({ data: { comments: [], total: 0, hasMore: false, nextOffset: 0 } });
            if (url.startsWith('/api/wall')) return Promise.resolve({ data: mockPosts });
            return Promise.resolve({ data: {} });
        });
        axios.post.mockResolvedValue({ data: {} });
    });

    it('renders posts and create form for authorized users', async () => {
        render(<CommunityWall currentUser={mockUser} showToast={vi.fn()} />);
        
        await waitFor(() => {
            expect(screen.getByText('Hello World')).toBeInTheDocument();
        });
        
        expect(screen.getByPlaceholderText(/Was beschäftigt dich, Test/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /POSTEN/i })).toBeInTheDocument();
    });

    it('hides create form for users without edit permission', async () => {
        const readOnlyUser = { ...mockUser, permissions: [{ key: 'HOME', canView: true, canEdit: false }] };
        render(<CommunityWall currentUser={readOnlyUser} showToast={vi.fn()} />);
        
        await waitFor(() => expect(screen.getByText('Hello World')).toBeInTheDocument());
        expect(screen.queryByText('POSTEN')).not.toBeInTheDocument();
    });

    it('can create a new post with content', async () => {
        render(<CommunityWall currentUser={mockUser} fetchPosts={vi.fn()} />);
        
        const textarea = await screen.findByPlaceholderText(/Was beschäftigt dich/i);
        fireEvent.change(textarea, { target: { value: 'New Post Content' } });
        
        const postBtn = screen.getByRole('button', { name: /POSTEN/i });
        fireEvent.click(postBtn);
        
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/wall', expect.any(FormData), expect.any(Object));
        });
    });

    it('can like a post', async () => {
        render(<CommunityWall currentUser={mockUser} showToast={vi.fn()} />);
        await waitFor(() => screen.getByText('Hello World'));

        const likeBtn = screen.getByLabelText(/Like post/i);
        fireEvent.click(likeBtn);
        
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/wall/p1/like');
        });
    });

    it('can toggle comments section', async () => {
        render(<CommunityWall currentUser={mockUser} showToast={vi.fn()} />);
        await waitFor(() => screen.getByText('Hello World'));
        
        const commToggle = screen.getByLabelText(/Toggle comments/i);
        fireEvent.click(commToggle);
        
        expect(await screen.findByPlaceholderText(/Schreibe einen Kommentar/i)).toBeInTheDocument();
    });

    it('remains stable when API returns empty data', async () => {
        axios.get.mockImplementation((url) => {
            if (url.startsWith('/api/channels')) return Promise.resolve({ data: [] });
            if (url.startsWith('/api/wall')) return Promise.resolve({ data: null });
            return Promise.resolve({ data: {} });
        });
        render(<CommunityWall currentUser={mockUser} showToast={vi.fn()} />);
        
        await waitFor(() => {
            expect(screen.queryByRole('button', { name: /POSTEN/i })).toBeInTheDocument();
        });
        expect(screen.queryByText('Hello World')).not.toBeInTheDocument();
    });

    it('handles delete post for owners/admins', async () => {
        const showConfirm = vi.fn((t, m, cb) => cb()); // Auto-confirm
        render(<CommunityWall currentUser={mockUser} showConfirm={showConfirm} showToast={vi.fn()} />);
        
        await waitFor(() => screen.getByText('Hello World'));
        
        const trashBtn = screen.getByLabelText(/Delete post/i);
        fireEvent.click(trashBtn);
        
        expect(showConfirm).toHaveBeenCalled();
        await waitFor(() => {
            expect(axios.delete).toHaveBeenCalledWith('/api/wall/p1');
        });
    });

    it('opens image lightbox and triggers download', async () => {
        const postWithImage = {
            ...mockPosts[0],
            attachments: ['https://example.com/image.jpg']
        };
        axios.get.mockImplementation((url) => {
            if (url.startsWith('/api/channels')) return Promise.resolve({ data: [] });
            if (url.startsWith('/api/wall')) return Promise.resolve({ data: [postWithImage] });
            return Promise.resolve({ data: {} });
        });
        
        // Mock fetch and URL for download
        const mockBlob = new Blob([''], { type: 'image/jpeg' });
        global.fetch = vi.fn().mockResolvedValue({
            blob: vi.fn().mockResolvedValue(mockBlob)
        });
        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();

        render(<CommunityWall currentUser={mockUser} showToast={vi.fn()} />);
        
        const img = await screen.findByAltText('Beitrag Anhang');
        fireEvent.click(img);
        
        expect(screen.getByAltText('Full size')).toBeInTheDocument();
        
        const downloadBtn = screen.getByRole('button', { name: /Download/i });
        fireEvent.click(downloadBtn);
        
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.jpg');
    });
});
