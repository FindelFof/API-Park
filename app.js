const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = 3000;


const pool = new Pool({
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD
});
//Middelware Admin
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {

        next();
    } else {
        res.status(403).json({ error: 'Permission denied' });
    }
};

app.use(express.json());

// Login utilisateur
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = $1';
    const values = [username];

    pool.query(query, values, (error, result) => {
        if (error) {
            console.error('Error during login:', error);
            res.status(500).json({ error: 'Failed to login' });
        } else {
            if (result.rows.length === 0) {
                res.status(401).json({ error: 'Invalid credentials' });
            } else {
                const user = result.rows[0];
                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (err) {
                        console.error('Error comparing passwords:', err);
                        res.status(500).json({ error: 'Failed to login' });
                    } else {
                        if (isMatch) {
                            const token = generateToken(user.id);
                            res.status(200).json({
                                message: 'Login successful',
                                id: user.id,
                                username: user.username,
                                token: token
                            });
                        } else {
                            res.status(401).json({ error: 'Invalid credentials' });
                        }
                    }
                });
            }
        }
    });
});



//Création d'un utilisateur
app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;
    const createdAt = new Date().toISOString();
    const queryCheckUsername = 'SELECT COUNT(*) FROM users WHERE username = $1';
    const queryInsertUser = 'INSERT INTO users (username, password, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $4) RETURNING id';

    try {
        const { rows } = await pool.query(queryCheckUsername, [username]);
        const existingUserCount = rows[0].count;
        console.log(existingUserCount);

        if (existingUserCount > 0) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const values = [username.toLowerCase(), hashedPassword, role, createdAt];
        const result = await pool.query(queryInsertUser, values);

        const userId = result.rows[0].id;
        res.status(201).json({ id: userId, message: 'User created successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ error: 'Failed to create user' });
    }
});



//Get utilisateur par ID
app.get('/users/:id', verifyToken, (req, res) => {
    const userId = req.params.id;
    const query = 'SELECT * FROM users WHERE id = $1';
    const values = [userId];

    pool.query(query, values, (error, result) => {
        if (error) {
            console.error('Error retrieving user:', error);
            res.status(500).json({ error: 'Failed to retrieve user' });
        } else {
            if (result.rows.length === 0) {
                res.status(404).json({ error: 'User not found' });
            } else {
                const user = result.rows[0];
                res.status(200).json(user);
            }
        }
    });
});

//MAJ utilisateur
app.put('/users/:id', verifyToken, (req, res) => {
    const userId = req.params.id;
    const { username, password, role } = req.body;
    const updatedAt = new Date().toISOString();
    const query = 'UPDATE users SET username = $1, password = $2, role = $3, updated_at = $4 WHERE id = $5';
    const values = [username.toLowerCase(), password, role, updatedAt, userId];

    pool.query(query, values, (error, result) => {
        if (error) {
            console.error('Error updating user:', error);
            res.status(500).json({ error: 'Failed to update user' });
        } else {
            if (result.rowCount === 0) {
                res.status(404).json({ error: 'User not found' });
            } else {
                res.status(200).json({ message: 'User updated successfully' });
            }
        }
    });
});

//Supp un utilisateur
app.delete('/users/:id', verifyToken, (req, res) => {
    const userId = req.params.id;
    const query = 'DELETE FROM users WHERE id = $1';
    const values = [userId];

    pool.query(query, values, (error, result) => {
        if (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({ error: 'Failed to delete user' });
        } else {
            if (result.rowCount === 0) {
                res.status(404).json({ error: 'User not found' });
            } else {
                res.status(200).json({ message: 'User deleted successfully' });
            }
        }
    });
});


// Créer une place de parking
app.post('/parking-spots', isAdmin, verifyToken, (req, res) => {
    const { spotNumber, floor } = req.body;
    const availability=true;
    const occupationTime=0;
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;
    const query =
        'INSERT INTO parking_spots (spot_number, floor, availability, occupation_time, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
    const values = [spotNumber, floor, availability, occupationTime, createdAt, updatedAt];

    pool.query(query, values, (error, result) => {
        if (error) {
            console.error('Error creating parking spot:', error);
            res.status(500).json({ error: 'Failed to create parking spot' });
        } else {
            const spotId = result.rows[0].id;
            res.status(201).json({ id: spotId, message: 'Parking spot created successfully' });
        }
    });
});



// Assigner une place de parking à un utilisateur
app.post('/parking-spots/:id/assign', (req, res) => {
    const spotId = req.params.id;
    const {occupancyTime} = req.body;
    const { userId } = req.body;
    const updatedAt = new Date().toISOString();
    const query = 'UPDATE parking_spots SET user_id = $1, occupancy_time = $2, updated_at = $3,availability = false WHERE id = $4';
    const values = [userId, occupancyTime, updatedAt, spotId];

    pool.query(query, values, (error, result) => {
        if (error) {
            console.error('Error assigning parking spot:', error);
            res.status(500).json({ error: 'Failed to assign parking spot' });
        } else {
            if (result.rowCount === 0) {
                res.status(404).json({ error: 'Parking spot not found' });
            } else {
                res.status(200).json({ message: 'Parking spot assigned successfully' });
            }
        }
    });
});

// Désassigner une place de parking à un utilisateur

app.post('/parking-spots/:id/unassign', (req, res) => {
    const spotId = req.params.id;
    const updatedAt = new Date().toISOString();
    const query = 'UPDATE parking_spots SET user_id = NULL, updated_at = $1 WHERE id = $2';
    const values = [updatedAt, spotId];

    pool.query(query, values, (error, result) => {
        if (error) {
            console.error('Error unassigned parking spot:', error);
            res.status(500).json({ error: 'Failed to unassigned parking spot' });
        } else {
            if (result.rowCount === 0) {
                res.status(404).json({ error: 'Parking spot not found' });
            } else {
                res.status(200).json({ message: 'Parking spot unassigned successfully' });
            }
        }
    });
});


// Rechercher une place libre (par étage)
app.get('/parking-spots/free/:floor', (req, res) => {
    const floor = req.params.floor;
    const query = 'SELECT * FROM parking_spots WHERE floor = $1 AND availability = true';
    const values = [floor];

    pool.query(query, values, (error, result) => {
        if (error) {
            console.error('Error retrieving free parking spots:', error);
            res.status(500).json({ error: 'Failed to retrieve free parking spots' });
        } else {
            const parkingSpots = result.rows;
            res.status(200).json(parkingSpots);
        }
    });
});


// Rechercher une place par utilisateur
app.get('/users/:id/parking-spot', (req, res) => {
    const userId = req.params.id;
    const query = 'SELECT * FROM parking_spots WHERE user_id = $1';
    const values = [userId];

    pool.query(query, values, (error, result) => {
        if (error) {
            console.error('Error retrieving parking spot:', error);
            res.status(500).json({ error: 'Failed to retrieve parking spot' });
        } else {
            const parkingSpot = result.rows[0];
            if (!parkingSpot) {
                res.status(404).json({ error: 'Parking spot not found for the user' });
            } else {
                res.status(200).json(parkingSpot);
            }
        }
    });
});
//Génération d'un Token
function generateToken(userId) {
    const payload = { userId };
    return jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: '1h'});
}
//Verification d'un Token
function verifyToken(req, res, next) {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        req.userId = decoded.userId;
        next();
    });
}


// Démarrage du serveur
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
