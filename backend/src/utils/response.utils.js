function success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
}

function error(res, message = 'Something went wrong', statusCode = 500, errors = null) {
    const response = {
        success: false,
        message
    };
    if (errors) response.errors = errors;
    return res.status(statusCode).json(response);
}

function paginated(res, rows, total, page, limit) {
    return res.status(200).json({
        success: true,
        data: rows,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    });
}

module.exports = { success, error, paginated };
