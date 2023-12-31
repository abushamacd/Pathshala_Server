const httpStatus = require("http-status");
const { ApiError } = require("../../../src/errors/apiError");
const {
  calculatePagination,
} = require("../../../src/helpers/paginationHelpers");
const { userSearchableFields, userPopulate } = require("./user.constant");
const User = require("./user.model");
const bcrypt = require("bcrypt");
const config = require("../../../src/config");

exports.getAllUsersService = async (paginationOptions, filters) => {
  const { page, limit, skip, sortBy, sortOrder } =
    calculatePagination(paginationOptions);
  const { searchTerm, ...filtersData } = filters;
  let andConditions = [];

  // search on the field
  if (searchTerm) {
    andConditions.push({
      $or: userSearchableFields.map((field) => ({
        [field]: {
          $regex: searchTerm,
          $options: "i",
        },
      })),
    });
  }

  // filtering on field
  if (Object.keys(filtersData).length) {
    andConditions.push({
      $and: Object.entries(filtersData).map(([field, value]) => ({
        [field]: {
          $regex: value,
          $options: "i",
        },
      })),
    });
  }

  // sorting
  let sortConditions = {};
  if (sortBy && sortOrder) {
    sortConditions[sortBy] = sortOrder;
  }

  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {};
  // output
  const result = await User.find(whereConditions)
    .populate("")
    .sort(sortConditions)
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments(whereConditions);
  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};

exports.getSingleUserService = async (id) => {
  const result = await User.findById(id);
  if (!result) {
    throw new Error("User not found !");
  }
  return result;
};

exports.updateUserService = async (_id, payload) => {
  const isExist = await User.findById(_id);
  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found !");
  }

  const { role, id, password, ...userData } = payload;
  const updatedUserData = { ...userData };

  // // dynamicallly handel object data. example: when name has include firstname and lastname
  // if (name && Object.keys(name).length > 0) {
  //   Object.keys(name).forEach((key) => {
  //     const dataKey = `name.${key}`;
  //     updatedUserData[dataKey] = name[key];
  //   });
  // }

  if (password) {
    const dataKey = `password`;
    updatedUserData[dataKey] = await bcrypt.hash(
      password,
      Number(config.bcrypt_solt_round)
    );
  }

  const result = await User.findOneAndUpdate({ _id }, updatedUserData, {
    new: true,
  });

  if (!result) {
    throw new Error("User update failed");
  }

  return result;
};

exports.deleteUserService = async (id) => {
  const isExist = await User.findById(id);
  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found !");
  }

  const result = await User.findByIdAndDelete(id);

  if (!result) {
    throw new Error("User delete failed");
  }
  return result;
};

exports.addToWishListService = async (id, bookId) => {
  const user = await User.findById(id);
  const alreadyAdded = user.wishlist.find(
    (id) => id.toString() === bookId.toString()
  );
  if (!alreadyAdded) {
    const result = await User.findByIdAndUpdate(
      id,
      {
        $push: { wishlist: bookId },
      },
      {
        new: true,
      }
    ).populate("wishlist");

    if (!result) {
      throw new Error("Book add to wishlist failed");
    }
    return result;
  } else {
    throw new Error("Already added");
  }
};

exports.removeFromWishListService = async (id, bookId) => {
  const user = await User.findById(id);
  const alreadyAdded = user.wishlist.find(
    (id) => id.toString() === bookId.toString()
  );
  if (alreadyAdded) {
    const result = await User.findByIdAndUpdate(
      id,
      {
        $pull: { wishlist: bookId },
      },
      {
        new: true,
      }
    ).populate("wishlist");

    if (!result) {
      throw new Error("Book remove from wishlist failed");
    }
    return result;
  } else {
    throw new Error("Already remove");
  }
};

exports.getUserProfileService = async (id) => {
  const result = await User.findById(id).populate(userPopulate);
  return result;
};

exports.addToReadListService = async (id, payload) => {
  const user = await User.findById(id);

  const alreadyAdded = user.readlist.find(
    (book) => book.bookId.toString() === payload.bookId.toString()
  );

  if (!alreadyAdded) {
    const result = await User.findByIdAndUpdate(
      id,
      {
        $push: { readlist: payload },
      },
      {
        new: true,
      }
    ).populate("readlist");

    if (!result) {
      throw new Error("Book add to readlist failed");
    }
    return result;
  } else {
    throw new Error("Already added");
  }
};

exports.markFinishedService = async (id, payload) => {
  const user = await User.findById(id);

  const alreadyAdded = user.readlist.find(
    (book) => book.bookId.toString() === payload.bookId.toString()
  );

  if (alreadyAdded) {
    const restBook = user.readlist.filter(
      (book) => book.bookId.toString() !== payload.bookId.toString()
    );

    const result = await User.findByIdAndUpdate(
      id,
      { readlist: [payload, ...restBook] },
      {
        new: true,
      }
    ).populate("readlist");

    if (!result) {
      throw new Error("Mark as finished failed");
    }
    return result;
  } else {
    throw new Error("Not in read list");
  }
};
