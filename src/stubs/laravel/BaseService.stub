<?php

namespace App\Services;

abstract class BaseService
{
    protected mixed $repository;

    public function __construct(mixed $repository)
    {
        $this->repository = $repository;
    }

    public function all(): mixed
    {
        return $this->repository->all();
    }

    public function find(int $id): mixed
    {
        return $this->repository->find($id);
    }

    public function create(array $data): mixed
    {
        return $this->repository->create($data);
    }

    public function update(int $id, array $data): mixed
    {
        return $this->repository->update($id, $data);
    }

    public function delete(int $id): bool
    {
        return $this->repository->delete($id);
    }
}
