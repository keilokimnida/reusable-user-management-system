const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { Accounts, PaymentMethods } = require('../schemas/Schemas').User;

const { ACCOUNT_STATUS } = require('../config/enums');

// ============================================================

module.exports.createAccount = async (meta, avatar) => {
    const {
        firstname, lastname, username, email, password,
        stripe_customer_id
    } = meta;

    const hash = bcrypt.hashSync(password, 10);

    const newAccount = await Accounts.create({
        firstname, lastname, username, email,
        status: 'active',
        passwords: [{ password: hash }],
        // stripe
        has_trialed: false,
        balance: 0,
        stripe_customer_id
    }, { include: 'passwords' });

    if (avatar) {
        // TODO avatar file upload
    }

    return newAccount;
};

// ============================================================

const includeActivePassword = (bool) => bool
    ? [{ association: 'passwords', where: { active: true }, limit: 1 }]
    : [];

// typescript
// type Identifier = 'account_id' | 'account_uuid' | 'username' | 'email';

module.exports.findAccountBy = {
    id: (account_id, { includePassword = false, include = [], ...others } = {}) => Accounts.findOne({
        ...others,
        where: { account_id },
        include: [...includeActivePassword(includePassword), ...include]
    }),
    uuid: (account_uuid, { includePassword = false, include = [], ...others } = {}) => Accounts.findOne({
        ...others,
        where: { account_uuid },
        include: [...includeActivePassword(includePassword), ...include]
    }),
    username: (username, { includePassword = false, include = [], ...others } = {}) => Accounts.findOne({
        ...others,
        where: { username },
        include: [...includeActivePassword(includePassword), ...include]
    }),
    email: (email, { includePassword = false, include = [], ...others } = {}) => Accounts.findOne({
        ...others,
        where: { email },
        include: [...includeActivePassword(includePassword), ...include]
    }),
    stripeCustomerId: (stripe_customer_id, includePaymentMethods = true) => Accounts.findOne({
        where: { stripe_customer_id },
        include: includePaymentMethods ? [{ model: PaymentMethods, as: 'payment_accounts' }] : []
    }),
    /** Finds one account with a value across multiple columns/identifiers */
    identifiers: (identifiers = [], value, { includePassword = false, include = [], ...others } = {}) => Accounts.findOne({
        ...others,
        where: { [Op.or]: identifiers.map((identifer) => ({ [identifer]: value })) },
        include: [...includeActivePassword(includePassword), ...include]
    })
};

module.exports.findAllAccounts = ({ where, include, attributes, ...others } = {}) =>
    Accounts.findAll({
        where,
        include,
        attributes,
        ...others
    });

module.exports.findOneAccount = ({ where, include, attributes, ...others } = {}) =>
    Accounts.findOne({
        where,
        include,
        attributes,
        ...others
    });

module.exports.lockAccount = (account_id) =>
    Accounts.update({
        status: ACCOUNT_STATUS.LOCKED
    }, { where: { account_id } });

module.exports.updateAccount = (account_id, details) =>
    Accounts.update(details, { where: account_id });
