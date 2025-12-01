const express = require('express');
const Media = require('../models/Media');

const router = express.Router();

router.get('/:id', async (req, res) => {
    try {
        const mediaItem = await Media.findById(req.params.id);
        if (!mediaItem || !mediaItem.data) {
            return res.status(404).json({ message: 'Media not found' });
        }

        const isVideo = mediaItem.mimeType && mediaItem.mimeType.startsWith('video/');
        const isImage = mediaItem.mimeType && mediaItem.mimeType.startsWith('image/');

        // Set appropriate headers
        res.set('Content-Type', mediaItem.mimeType || 'application/octet-stream');
        res.set('Cache-Control', 'public, max-age=31536000');
        
        // For videos, support range requests for proper streaming
        if (isVideo) {
            const range = req.headers.range;
            const fileSize = mediaItem.data.length;
            
            if (range) {
                // Parse range header
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunkSize = (end - start) + 1;
                
                // Set partial content headers
                res.status(206); // Partial Content
                res.set({
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize.toString()
                });
                
                // Send partial chunk
                res.send(mediaItem.data.slice(start, end + 1));
            } else {
                // Send full video
                res.set('Content-Length', fileSize.toString());
                res.set('Accept-Ranges', 'bytes');
                res.send(mediaItem.data);
            }
        } else {
            // For images and other files, send as-is
            res.send(mediaItem.data);
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
