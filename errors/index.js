'use strict';

/**
 * Base error for custom errors thrown by VoucherAPI function app.
 */
class BaseError extends Error {
    constructor (message, code) {
        super(message);
        this.name = 'VouchersApiFunctionsBaseError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.BaseError = BaseError;

class VouchersApiServerError extends BaseError {
    constructor (message, code) {
        super(message, code);
        this.name = 'VouchersApiServerError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.VouchersApiServerError = VouchersApiServerError;

class InvalidUUIDError extends BaseError {
    constructor (message, code) {
        super(message, code);
        this.name = 'InvalidUUIDError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.InvalidUUIDError = InvalidUUIDError;

class EmptyRequestBodyError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'EmptyRequestBodyError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.EmptyRequestBodyError = EmptyRequestBodyError;

class DuplicateVoucherError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'DuplicateVoucherError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.DuplicateVoucherError = DuplicateVoucherError;

class VoucherNotFoundError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'VoucherNotFoundError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.VoucherNotFoundError = VoucherNotFoundError;

class UserNotAuthenticatedError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'UserNotAuthenticatedError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.UserNotAuthenticatedError = UserNotAuthenticatedError;

class MissingPassTokenError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingPassTokenError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingPassTokenError = MissingPassTokenError;

class MissingVoucherTokenError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingVoucherTokenError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingVoucherTokenError = MissingVoucherTokenError;

class MissingPartnerNetworkIDError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingPartnerNetworkIDError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingPartnerNetworkIDError = MissingPartnerNetworkIDError;

class MissingLinkedIDError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingLinkedIDError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingLinkedIDError = MissingLinkedIDError;

class VoucherRedeemdedError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'VoucherRedeemdedError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.VoucherRedeemdedError = VoucherRedeemdedError;

class VoucherExpiredError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'VoucherExpiredError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.VoucherExpiredError = VoucherExpiredError;

class VoucherLockedError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'VoucherLockedError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.VoucherLockedError = VoucherLockedError;

class VoucherValidWeekdaysError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'VoucherValidWeekdaysError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.VoucherValidWeekdaysError = VoucherValidWeekdaysError;

class VoucherValidTimeError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'VoucherValidTimeError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.VoucherValidTimeError = VoucherValidTimeError;

class IncorrectVoucherPinCodeError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'IncorrectVoucherPinCodeError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.IncorrectVoucherPinCodeError = IncorrectVoucherPinCodeError;

class MissingRedemptionCodeError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingRedemptionCodeError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingRedemptionCodeError = MissingRedemptionCodeError;

class MissingMerchantIDError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingMerchantIDError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingMerchantIDError = MissingMerchantIDError;

class MissingsettleValueOnRedemptionError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingsettleValueOnRedemptionError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingsettleValueOnRedemptionError = MissingsettleValueOnRedemptionError;


class MissingBalanceAccountIDError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingBalanceAccountIDError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingBalanceAccountIDError = MissingBalanceAccountIDError;

class IncorrectRedemptionCodeError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'IncorrectRedemptionCodeError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.IncorrectRedemptionCodeError = IncorrectRedemptionCodeError;

class IncorrectMerchantIDError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'IncorrectMerchantIDError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.IncorrectMerchantIDError = IncorrectMerchantIDError;

class RedemptionCostError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'RedemptionCostError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.RedemptionCostError = RedemptionCostError;


class MerchantIDNotLinked extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MerchantIDNotLinked';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MerchantIDNotLinked = MerchantIDNotLinked;

class MissingSalesPersonCodeError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingSalesPersonCodeError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingSalesPersonCodeError = MissingSalesPersonCodeError;

class MissingFixedAmountError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingFixedAmountError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingFixedAmountError = MissingFixedAmountError;

class IncorrectSettleValueOnRedemptionError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'IncorrectSettleValueOnRedemptionError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.IncorrectSettleValueOnRedemptionError = IncorrectSettleValueOnRedemptionError;

class MissingCurrencyError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingCurrencyError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingCurrencyError = MissingCurrencyError;

class VoucherCurrencyMismatchError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'VoucherCurrencyMismatchError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.VoucherCurrencyMismatchError = VoucherCurrencyMismatchError;

class RedemptionFixedAmountExceededError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'RedemptionFixedAmountExceededError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.RedemptionFixedAmountExceededError = RedemptionFixedAmountExceededError;

class MissingRedemptionsCountError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingRedemptionsCountError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingRedemptionsCountError = MissingRedemptionsCountError;

class NoRedemptionsLeftError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'NoRedemptionsLeftError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.NoRedemptionsLeftError = NoRedemptionsLeftError;

class MerchantApiError extends BaseError {
    constructor (name, message, code) {
        super(message, code);
        this.name = name;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MerchantApiError = MerchantApiError;

class WalletNotFoundError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'WalletNotFoundError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.WalletNotFoundError = WalletNotFoundError;

class PassNotFoundError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'PassNotFoundError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.PassNotFoundError = PassNotFoundError;

class FieldValidationError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'FieldValidationError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.FieldValidationError = FieldValidationError;

class DuplicateBalanceAccountError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'DuplicateBalanceAccountError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.DuplicateBalanceAccountError = DuplicateBalanceAccountError;

class BalanceAccountNotFoundError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'BalanceAccountNotFoundError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.BalanceAccountNotFoundError = BalanceAccountNotFoundError;

class PartnerNetworkNotFoundError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'PartnerNetworkNotFoundError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.PartnerNetworkNotFoundError = PartnerNetworkNotFoundError;

class MerchantNotMemberError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MerchantNotMemberError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MerchantNotMemberError = MerchantNotMemberError;

class DuplicateVoucherLinkError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'DuplicateVoucherLinkError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.DuplicateVoucherLinkError = DuplicateVoucherLinkError;

class VoucherLinkNotFoundError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'VoucherLinkNotFoundError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.VoucherLinkNotFoundError = VoucherLinkNotFoundError;

class partnerNetworkInvitesNotFound extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'partnerNetworkInvitesNotFound';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.partnerNetworkInvitesNotFound = partnerNetworkInvitesNotFound;

class NotAuthenticatedError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'NotAuthenticatedError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.NotAuthenticatedError = NotAuthenticatedError;

class MerchantAlreadyInvited extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MerchantAlreadyInvited';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MerchantAlreadyInvited = MerchantAlreadyInvited;

class MemberAlreadyRequested extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MemberAlreadyRequested';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MemberAlreadyRequested = MemberAlreadyRequested;

class PartnerNetworkNotAuthorized extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'PartnerNetworkNotAuthorized';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.PartnerNetworkNotAuthorized = PartnerNetworkNotAuthorized;

class PartnerNetworkMembersNotFound extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'PartnerNetworkMembersNotFound';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.PartnerNetworkMembersNotFound = PartnerNetworkMembersNotFound;


class MerchantPartnerNetworkNotFoundError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MerchantPartnerNetworkNotFoundError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MerchantPartnerNetworkNotFoundError = MerchantPartnerNetworkNotFoundError;

class PartnerNetworkNotInvited extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'PartnerNetworkNotInvited';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.PartnerNetworkNotInvited = PartnerNetworkNotInvited;

class VoucherLogNotFoundError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'VoucherLogNotFoundError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.VoucherLogNotFoundError = VoucherLogNotFoundError;

class TransactionError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'TransactionError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.TransactionError = TransactionError;

class RedemptionstNotFoundError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'RedemptionstNotFoundError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.RedemptionstNotFoundError = RedemptionstNotFoundError;

class DuplicateBalanceAccountTransactions extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'DuplicateBalanceAccountTransactions';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.DuplicateBalanceAccountTransactions = DuplicateBalanceAccountTransactions;

class DuplicatePartnerNetworkss extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'DuplicatePartnerNetworkss';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.DuplicatePartnerNetworkss = DuplicatePartnerNetworkss;

class MissingVoucherIDError extends BaseError {
    constructor (message, code) {
        super(message);
        this.name = 'MissingVoucherIDError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.MissingVoucherIDError = MissingVoucherIDError;