"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsService = void 0;
var common_1 = require("@nestjs/common");
function slugify(input) {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}
var ProjectsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ProjectsService = _classThis = /** @class */ (function () {
        function ProjectsService_1(prisma) {
            this.prisma = prisma;
        }
        ProjectsService_1.prototype.list = function (query) {
            return __awaiter(this, void 0, void 0, function () {
                var q, category, status, place, area, _a, page, _b, pageSize, published, where, skip, take, _c, items, total;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            q = query.q, category = query.category, status = query.status, place = query.place, area = query.area, _a = query.page, page = _a === void 0 ? 1 : _a, _b = query.pageSize, pageSize = _b === void 0 ? 10 : _b, published = query.published;
                            where = {};
                            if (q) {
                                where.OR = [
                                    { title: { contains: q, mode: 'insensitive' } },
                                    { summary: { contains: q, mode: 'insensitive' } },
                                    { content: { contains: q, mode: 'insensitive' } },
                                ];
                            }
                            if (category)
                                where.category = { contains: category, mode: 'insensitive' };
                            if (status)
                                where.status = status;
                            if (place)
                                where.place = { contains: place, mode: 'insensitive' };
                            if (area)
                                where.area = { contains: area, mode: 'insensitive' };
                            if (published !== undefined)
                                where.published = published;
                            skip = (page - 1) * pageSize;
                            take = pageSize;
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.project.findMany({ where: where, orderBy: { updatedAt: 'desc' }, skip: skip, take: take }),
                                    this.prisma.project.count({ where: where }),
                                ])];
                        case 1:
                            _c = _d.sent(), items = _c[0], total = _c[1];
                            return [2 /*return*/, { items: items, total: total, page: page, pageSize: pageSize }];
                    }
                });
            });
        };
        ProjectsService_1.prototype.getBySlug = function (slug) {
            return __awaiter(this, void 0, void 0, function () {
                var found;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.project.findUnique({ where: { slug: slug } })];
                        case 1:
                            found = _a.sent();
                            if (!found)
                                throw new common_1.NotFoundException('Proyecto no encontrado');
                            return [2 /*return*/, found];
                    }
                });
            });
        };
        ProjectsService_1.prototype.create = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var title, category, place, area, dupCombo, baseForSlug, slug, dupSlug;
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            title = (_a = dto.title) === null || _a === void 0 ? void 0 : _a.trim();
                            if (!title)
                                throw new common_1.BadRequestException('El campo "title" es requerido y no puede estar vacío.');
                            category = (_b = dto.category) === null || _b === void 0 ? void 0 : _b.trim();
                            place = (_c = dto.place) === null || _c === void 0 ? void 0 : _c.trim();
                            area = (_d = dto.area) === null || _d === void 0 ? void 0 : _d.trim();
                            if (!category)
                                throw new common_1.BadRequestException('El campo "category" es requerido.');
                            if (!place)
                                throw new common_1.BadRequestException('El campo "place" es requerido.');
                            if (!area)
                                throw new common_1.BadRequestException('El campo "area" es requerido.');
                            return [4 /*yield*/, this.prisma.project.findFirst({
                                    where: { title: title, place: place, area: area },
                                })];
                        case 1:
                            dupCombo = _f.sent();
                            if (dupCombo) {
                                throw new common_1.BadRequestException("Ya existe un proyecto con el t\u00EDtulo \"".concat(title, "\" en el lugar \"").concat(place, "\" y \u00E1rea \"").concat(area, "\"."));
                            }
                            baseForSlug = ((_e = dto.slug) === null || _e === void 0 ? void 0 : _e.trim()) || "".concat(title, "-").concat(place);
                            slug = slugify(baseForSlug);
                            if (!slug)
                                throw new common_1.BadRequestException('No fue posible generar un slug válido.');
                            return [4 /*yield*/, this.prisma.project.findUnique({ where: { slug: slug } })];
                        case 2:
                            dupSlug = _f.sent();
                            if (dupSlug)
                                throw new common_1.BadRequestException("El slug \"".concat(slug, "\" ya existe."));
                            return [2 /*return*/, this.prisma.project.create({
                                    data: __assign(__assign({}, dto), { title: title, slug: slug, category: category, place: place, area: area }),
                                })];
                    }
                });
            });
        };
        ProjectsService_1.prototype.update = function (id, dto) {
            return __awaiter(this, void 0, void 0, function () {
                var existing, nextTitle, nextCategory, nextPlace, nextArea, t, c, p, a, dupCombo, nextSlug, dupSlug;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.project.findUnique({ where: { id: id } })];
                        case 1:
                            existing = _a.sent();
                            if (!existing)
                                throw new common_1.NotFoundException('Proyecto no encontrado');
                            nextTitle = existing.title;
                            nextCategory = existing.category;
                            nextPlace = existing.place;
                            nextArea = existing.area;
                            if (dto.title !== undefined) {
                                t = dto.title.trim();
                                if (!t)
                                    throw new common_1.BadRequestException('El campo "title" no puede estar vacío.');
                                nextTitle = t;
                            }
                            if (dto.category !== undefined) {
                                c = dto.category.trim();
                                if (!c)
                                    throw new common_1.BadRequestException('El campo "category" no puede estar vacío.');
                                nextCategory = c;
                            }
                            if (dto.place !== undefined) {
                                p = dto.place.trim();
                                if (!p)
                                    throw new common_1.BadRequestException('El campo "place" no puede estar vacío.');
                                nextPlace = p;
                            }
                            if (dto.area !== undefined) {
                                a = dto.area.trim();
                                if (!a)
                                    throw new common_1.BadRequestException('El campo "area" no puede estar vacío.');
                                nextArea = a;
                            }
                            return [4 /*yield*/, this.prisma.project.findFirst({
                                    where: {
                                        title: nextTitle,
                                        place: nextPlace,
                                        area: nextArea,
                                        NOT: { id: id },
                                    },
                                })];
                        case 2:
                            dupCombo = _a.sent();
                            if (dupCombo) {
                                throw new common_1.BadRequestException("Ya existe un proyecto con el t\u00EDtulo \"".concat(nextTitle, "\" en el lugar \"").concat(nextPlace, "\" y \u00E1rea \"").concat(nextArea, "\"."));
                            }
                            nextSlug = existing.slug;
                            if (dto.slug && dto.slug.trim().length) {
                                nextSlug = slugify(dto.slug);
                            }
                            else if (dto.title !== undefined || dto.place !== undefined) {
                                nextSlug = slugify("".concat(nextTitle, "-").concat(nextPlace));
                            }
                            if (!nextSlug)
                                throw new common_1.BadRequestException('No fue posible generar un slug válido.');
                            if (!(nextSlug !== existing.slug)) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.project.findUnique({ where: { slug: nextSlug } })];
                        case 3:
                            dupSlug = _a.sent();
                            if (dupSlug && dupSlug.id !== id) {
                                throw new common_1.BadRequestException("El slug \"".concat(nextSlug, "\" ya existe."));
                            }
                            _a.label = 4;
                        case 4: return [2 /*return*/, this.prisma.project.update({
                                where: { id: id },
                                data: __assign(__assign({}, dto), { title: nextTitle, slug: nextSlug, category: nextCategory, place: nextPlace, area: nextArea }),
                            })];
                    }
                });
            });
        };
        ProjectsService_1.prototype.remove = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.project.findUniqueOrThrow({ where: { id: id } })];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.project.delete({ where: { id: id } })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, { ok: true }];
                    }
                });
            });
        };
        return ProjectsService_1;
    }());
    __setFunctionName(_classThis, "ProjectsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ProjectsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ProjectsService = _classThis;
}();
exports.ProjectsService = ProjectsService;
