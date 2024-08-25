const Joi = require("joi");
const mongodbIdPattern = /^[0-9a-fA-F]{24}$/;
const Blog = require("../models/blog");
const BlogDTO = require("../dto/blog");
const Comment = require("../models/comment");
const fs = require("fs");
const { BACKEND_SERVER_PATH } = require("../config/index");
const BlogDetailsDTO = require("../dto/blog-details");

const blogController = {
  async create(req, res, next) {
    const createBlogSchema = Joi.object({
      title: Joi.string().required(),
      content: Joi.string().required(),
      photo: Joi.string().required(),
      author: Joi.string().regex(mongodbIdPattern).required(),
    });

    const { error } = createBlogSchema.validate(req.body);
    if (error) {
      return next(error);
    }
    const { title, author, content, photo } = req.body;

    const buffer = Buffer.from(
      photo.replace(/^data:image\/(png|jpg|jpeg);base64,/, ""),
      "base64"
    );
    const imagePath = `${Date.now()}-${author}.png`;
    try {
      fs.writeFileSync(`storage/${imagePath}`, buffer);
    } catch (error) {
      return next(error);
    }

    try {
      newBlog = new Blog({
        title,
        author,
        content,
        photoPath: `${BACKEND_SERVER_PATH}/storage/${imagePath}`,
      });

      await newBlog.save();
    } catch (error) {
      return next(error);
    }

    const blogDto = new BlogDTO(newBlog);

    return res.status(201).json({ blog: blogDto });
  },
  async getAll(req, res, next) {
    try {
      const blogs = await Blog.find({});
      const blogDto = [];

      for (let i = 0; i < blogs.length; i++) {
        const dto = new BlogDTO(blogs[i]);
        blogDto.push(dto);
      }

      return res.status(200).json({ blogs: blogDto });
    } catch (error) {}
  },
  async getById(req, res, next) {
    const getIdSchema = Joi.object({
      id: Joi.string().regex(mongodbIdPattern).required(),
    });
    const { error } = getIdSchema.validate(req.params);
    if (error) {
      return next(error);
    }
    const { id } = req.params;
    let blog;
    try {
      blog = await Blog.findOne({ _id: id }).populate("author");
    } catch (error) {
      return next(error);
    }
    const detailsDto = new BlogDetailsDTO(blog);
    return res.status(200).json({ blog: detailsDto });
  },
  async update(req, res, next) {
    const updateBlogSchema = Joi.object({
      title: Joi.string().required(),
      content: Joi.string().required(),
      author: Joi.string().regex(mongodbIdPattern).required(),
      blogId: Joi.string().regex(mongodbIdPattern).required(),
      photo: Joi.string(),
    });
    const { error } = updateBlogSchema.validate(req.body);
    if (error) {
      return next(error);
    }
    const { title, content, author, blogId, photo } = req.body;
    let blog;
    try {
      blog = await Blog.findOne({ _id: blogId });
    } catch (error) {
      return next(error);
    }

    if (photo) {
      let previousPhoto = blog.photoPath;

      previousPhoto = previousPhoto.split("/").at(-1);

      // delete photo
      fs.unlinkSync(`storage/${previousPhoto}`);

      // read as buffer
      const buffer = Buffer.from(
        photo.replace(/^data:image\/(png|jpg|jpeg);base64,/, ""),
        "base64"
      );

      // allot a random name
      const imagePath = `${Date.now()}-${author}.png`;

      // save locally

      try {
        fs.writeFileSync(`storage/${imagePath}`, buffer);
      } catch (error) {
        return next(error);
      }

      await Blog.updateOne(
        { _id: blogId },
        {
          title,
          content,
          photoPath: `${BACKEND_SERVER_PATH}/storage/${imagePath}`,
        }
      );
    } else {
      await Blog.updateOne({ _id: blogId }, { title, content });
    }

    return res.status(200).json({ message: "blog updated!" });
  },
  async delete(req, res, next) {
    const deleteBlogSchema = Joi.object({
      id: Joi.string().regex(mongodbIdPattern).required(),
    });

    const { error } = deleteBlogSchema.validate(req.params);
    if (error) {
      return next(error);
    }

    const { id } = req.params;

    // delete blog
    // delete comments
    try {
      await Blog.deleteOne({ _id: id });

      await Comment.deleteMany({ blog: id });
    } catch (error) {
      return next(error);
    }

    return res.status(200).json({ message: "blog deleted" });
  },
};
module.exports = blogController;
