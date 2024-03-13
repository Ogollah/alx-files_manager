#!/usr/bin/node


import { tmpdir } from 'os';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { mkdir, writeFile, stat, existsSync, realpath } from 'fs';
import { join as joinPath } from 'path';
import { Request, Response } from 'express';
import { contentType } from 'mime-types';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from '../utils/db';
import { getUserFromXToken } from '../utils/auth';

const mkDirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);
const statAsync = promisify(stat);
const realpathAsync = promisify(realpath);

const VALID_FILE_TYPES = {
  folder: 'folder',
  file: 'file',
  image: 'image',
};
const ROOT_FOLDER_ID = '0';
const DEFAULT_ROOT_FOLDER = 'files_manager';
const MAX_FILES_PER_PAGE = 20;
const NULL_ID = '000000000000000000000000'; // 24 characters of '0'

export default class FilesController {
  /**
   * Uploads a file.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async postUpload(req, res) {
    try {
      const { user } = req;
      const { name, type, parentId, isPublic, data } = req.body;

      // Input validation
      if (!name || !type || !Object.values(VALID_FILE_TYPES).includes(type)) {
        throw new Error('Invalid request: Missing or invalid parameters.');
      }

      const userId = user._id.toString();
      const baseDir = process.env.FOLDER_PATH || joinPath(tmpdir(), DEFAULT_ROOT_FOLDER);

      // Prepare file object
      const newFile = {
        userId: new mongoDBCore.BSON.ObjectId(userId),
        name,
        type,
        isPublic: Boolean(isPublic),
        parentId: parentId === ROOT_FOLDER_ID ? ROOT_FOLDER_ID : new mongoDBCore.BSON.ObjectId(parentId),
      };

      // Create directory if it doesn't exist
      await mkDirAsync(baseDir, { recursive: true });

      // Save file
      if (type !== VALID_FILE_TYPES.folder) {
        const localPath = joinPath(baseDir, uuidv4());
        await writeFileAsync(localPath, Buffer.from(data, 'base64'));
        newFile.localPath = localPath;
      }

      // Insert file into database
      const insertionInfo = await dbClient.filesCollection().insertOne(newFile);
      const fileId = insertionInfo.insertedId.toString();

      // Start thumbnail generation worker for images
      if (type === VALID_FILE_TYPES.image) {
        const jobName = `Image thumbnail [${userId}-${fileId}]`;
        fileQueue.add({ userId, fileId, name: jobName });
      }

      res.status(201).json({
        id: fileId,
        userId,
        name,
        type,
        isPublic,
        parentId: parentId === ROOT_FOLDER_ID ? 0 : parentId,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  }

  static async getShow(req, res) {
      const { user } = req;
      const id = req.params ? req.params.id : NULL_ID;
      const userId = user._id.toString();
      const file = await (await dbClient.filesCollection())
        .findOne({
          _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
          userId: new mongoDBCore.BSON.ObjectId(isValidId(userId) ? userId : NULL_ID),
        });

      if (!file) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId === ROOT_FOLDER_ID.toString()
          ? 0
          : file.parentId.toString(),
      });
    }

    /**
     * Retrieves files associated with a specific user.
     * @param {Request} req The Express request object.
     * @param {Response} res The Express response object.
     */
    static async getIndex(req, res) {
      const { user } = req;
      const parentId = req.query.parentId || ROOT_FOLDER_ID.toString();
      const page = /\d+/.test((req.query.page || '').toString())
        ? Number.parseInt(req.query.page, 10)
        : 0;
      const filesFilter = {
        userId: user._id,
        parentId: parentId === ROOT_FOLDER_ID.toString()
          ? parentId
          : new mongoDBCore.BSON.ObjectId(isValidId(parentId) ? parentId : NULL_ID),
      };

      const files = await (await (await dbClient.filesCollection())
        .aggregate([
          { $match: filesFilter },
          { $sort: { _id: -1 } },
          { $skip: page * MAX_FILES_PER_PAGE },
          { $limit: MAX_FILES_PER_PAGE },
          {
            $project: {
              _id: 0,
              id: '$_id',
              userId: '$userId',
              name: '$name',
              type: '$type',
              isPublic: '$isPublic',
              parentId: {
                $cond: { if: { $eq: ['$parentId', '0'] }, then: 0, else: '$parentId' },
              },
            },
          },
        ])).toArray();
      res.status(200).json(files);
    }

    static async putPublish(req, res) {
      const { user } = req;
      const { id } = req.params;
      const userId = user._id.toString();
      const fileFilter = {
        _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
        userId: new mongoDBCore.BSON.ObjectId(isValidId(userId) ? userId : NULL_ID),
      };
      const file = await (await dbClient.filesCollection())
        .findOne(fileFilter);

      if (!file) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      await (await dbClient.filesCollection())
        .updateOne(fileFilter, { $set: { isPublic: true } });
      res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: true,
        parentId: file.parentId === ROOT_FOLDER_ID.toString()
          ? 0
          : file.parentId.toString(),
      });
    }

    static async putUnpublish(req, res) {
      const { user } = req;
      const { id } = req.params;
      const userId = user._id.toString();
      const fileFilter = {
        _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
        userId: new mongoDBCore.BSON.ObjectId(isValidId(userId) ? userId : NULL_ID),
      };
      const file = await (await dbClient.filesCollection())
        .findOne(fileFilter);

      if (!file) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      await (await dbClient.filesCollection())
        .updateOne(fileFilter, { $set: { isPublic: false } });
      res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: false,
        parentId: file.parentId === ROOT_FOLDER_ID.toString()
          ? 0
          : file.parentId.toString(),
      });
    }

    /**
     * Retrieves the content of a file.
     * @param {Request} req The Express request object.
     * @param {Response} res The Express response object.
     */
    static async getFile(req, res) {
      const user = await getUserFromXToken(req);
      const { id } = req.params;
      const size = req.query.size || null;
      const userId = user ? user._id.toString() : '';
      const fileFilter = {
        _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
      };
      const file = await (await dbClient.filesCollection())
        .findOne(fileFilter);

      if (!file || (!file.isPublic && (file.userId.toString() !== userId))) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      if (file.type === VALID_FILE_TYPES.folder) {
        res.status(400).json({ error: 'A folder doesn\'t have content' });
        return;
      }
      let filePath = file.localPath;
      if (size) {
        filePath = `${file.localPath}_${size}`;
      }
      if (existsSync(filePath)) {
        const fileInfo = await statAsync(filePath);
        if (!fileInfo.isFile()) {
          res.status(404).json({ error: 'Not found' });
          return;
        }
      } else {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const absoluteFilePath = await realpathAsync(filePath);
      res.setHeader('Content-Type', contentType(file.name) || 'text/plain; charset=utf-8');
      res.status(200).sendFile(absoluteFilePath);
    }
}
